#!/usr/bin/env bash
set -Eeuo pipefail

REPO="ptr-prkr/k3s-homelab"
NAMESPACE="uptimeops"
WORKFLOW="ci.yml"

# Prevent overlapping deployments.
exec 9>/tmp/uptimeops-ghcr-deploy.lock
flock -n 9 || {
  echo "Another deployment check is running."
  exit 0
}

cd /home/peter/projects/k3s-homelab

# Check the latest main-branch push workflow, not merely
# the latest successful workflow.
RUN="$(gh run list \
  --repo "$REPO" \
  --workflow "$WORKFLOW" \
  --branch main \
  --event push \
  --limit 1 \
  --json headSha,status,conclusion \
  --jq '.[0] | [.headSha,.status,.conclusion] | @tsv')"

read -r SHA STATUS CONCLUSION <<< "$RUN"

if [[ -z "${SHA:-}" ]]; then
  echo "No workflow run found."
  exit 1
fi

if [[ "$STATUS" != "completed" || "$CONCLUSION" != "success" ]]; then
  echo "Latest workflow is not successful ($STATUS/$CONCLUSION). Skipping."
  exit 0
fi

# Respect intentional shutdowns.
for component in api worker frontend; do
  replicas="$(kubectl -n "$NAMESPACE" get deployment \
    "uptimeops-$component" \
    -o jsonpath='{.spec.replicas}')"

  if [[ "$replicas" != "1" ]]; then
    echo "uptimeops-$component has $replicas replicas. Skipping deployment."
    exit 0
  fi
done

echo "Latest successful main commit: $SHA"

for component in api worker frontend; do
  deployment="uptimeops-$component"
  image="ghcr.io/ptr-prkr/$deployment:$SHA"

  current="$(kubectl -n "$NAMESPACE" get deployment "$deployment" \
    -o jsonpath="{.spec.template.spec.containers[0].image}")"

  policy="$(kubectl -n "$NAMESPACE" get deployment "$deployment" \
    -o jsonpath="{.spec.template.spec.containers[0].imagePullPolicy}")"

  if [[ "$current" == "$image" && "$policy" == "IfNotPresent" ]]; then
    echo "$deployment already uses $SHA"
    continue
  fi

  echo "Deploying $deployment"

  # Permit k3s to pull immutable commit-tagged images.
  kubectl -n "$NAMESPACE" patch deployment "$deployment" \
    --type=strategic \
    -p "{\"spec\":{\"template\":{\"spec\":{\"containers\":[{\"name\":\"$component\",\"imagePullPolicy\":\"IfNotPresent\"}]}}}}"

  kubectl -n "$NAMESPACE" set image \
    "deployment/$deployment" "$component=$image"

  if ! kubectl -n "$NAMESPACE" rollout status \
    "deployment/$deployment" --timeout=180s; then
    echo "ERROR: $deployment rollout failed."
    echo "Inspect the Pods before attempting rollback."
    exit 1
  fi
done

echo "Deployment verification:"
kubectl -n "$NAMESPACE" get deployments
kubectl -n "$NAMESPACE" get pods
echo "Deployment check complete: $SHA"
