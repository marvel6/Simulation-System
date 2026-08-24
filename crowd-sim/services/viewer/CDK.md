# CDK wiring notes (you add this to ecs-stack yourself)
#
# - Image: ContainerImage.fromAsset('..', { file: 'services/viewer/Dockerfile' })
# - Port: 8080 (container port + ALB target group)
# - Env: REDIS_URL (same as partitions), optional VIEWER_STREAM_MS=200
# - Security group: same Redis client SG
# - Needs a public ALB (or similar) on the viewer service — partitions stay private
# - Redeploy simulation too so partitions publish viewer-agents snapshots
