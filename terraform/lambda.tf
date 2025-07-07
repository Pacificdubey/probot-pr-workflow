resource "aws_lambda_function" "probot" {
  function_name    = "dops-deply-bot"
  # filename         = "${path.module}/../dist.zip"
  s3_bucket =     "build-artifacts"
  s3_key =   "app/deploy-bot/dist.zip"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = "arn:aws:iam::6472245:role/lambda-role"
  timeout          = var.lambda_timeout

  environment {
    variables = {
      PROBOT_PARAM_PREFIX = "/bot/probot"
      LOG_LEVEL = "debug"
      NODE_ENV = "production"
    }
  }
}
