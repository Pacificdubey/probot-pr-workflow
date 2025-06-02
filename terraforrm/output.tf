output "webhook_url" {
  value       = "${aws_api_gateway_deployment.deployment.invoke_url}/dev/api/github/webhook"
  description = "Use this webhook URL in your GitHub App settings"
}
