resource "aws_ssm_parameter" "probot_app_id" {
  name  = "/bot/APP_ID"
  type  = "SecureString"
  value = var.app_id
  key_id = "2a5ae5b7"
}

resource "aws_ssm_parameter" "probot_webhook_secret" {
  name  = "/bot/WEBHOOK_SECRET"
  type  = "SecureString"
  value = var.webhook_secret
  key_id = "2a5ae5b7"
}

resource "aws_ssm_parameter" "probot_private_key" {
  name  = "/dops/probot/PRIVATE_KEY"
  type  = "SecureString"
  value = var.private_key
  key_id = "2a5ae5b7"
}
