resource "aws_lambda_function" "probot" {
  function_name    = "github-pr-deploy-bot"
  filename         = "${path.module}/../dist.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist.zip")
  handler          = "dist/handler.handler"
  runtime          = "nodejs18.x"
  role             = aws_iam_role.lambda_exec.arn
  timeout          = var.lambda_timeout

  environment {
    variables = {
      APP_ID         = var.app_id
      PRIVATE_KEY    = var.private_key
      WEBHOOK_SECRET = var.webhook_secret
      NODE_ENV       = "production"
      LOG_LEVEL      = "debug"
    }
  }
}
