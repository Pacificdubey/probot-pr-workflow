resource "aws_ssm_parameter" "probot_app_id" {
  name  = "/bot/probot/APP_ID"
  type  = "SecureString"
  value = var.app_id
}

resource "aws_ssm_parameter" "probot_webhook_secret" {
  name  = "/bot/probot/WEBHOOK_SECRET"
  type  = "SecureString"
  value = var.webhook_secret
}

resource "aws_ssm_parameter" "probot_private_key" {
  name  = "/bot/probot/PRIVATE_KEY"
  type  = "SecureString"
  value = file("./test-app-sample-test.2025-07-07.private-key.pem")
}
