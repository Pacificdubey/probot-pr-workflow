output "webhook_url" {
  value       = "${aws_api_gateway_stage.probot_stage.invoke_url}/api/github/webhook"
  description = "Use this webhook URL in your GitHub App settings"
}
