resource "aws_lambda_function" "probot" {
  function_name    = "probot"
  filename         = "${path.module}/../dist.zip"
  source_code_hash = filebase64sha256("${path.module}/../dist.zip")
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = "arn:aws:iam::542891270123:role/execution-role"
  timeout          = var.lambda_timeout

  environment {
    variables = {
      APP_ID         = var.app_id
      PRIVATE_KEY    = var.private_key
      WEBHOOK_SECRET = var.webhook_secret
    }
  }
}
