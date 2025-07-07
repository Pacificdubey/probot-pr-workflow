resource "aws_lambda_function" "probot" {
  function_name    = "dops-deply-bot"
  s3_bucket =     "mybuckets3probot"
  s3_key =   "app/deploy-bot/dist.zip"
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  timeout          = var.lambda_timeout

  environment {
    variables = {
      PROBOT_PARAM_PREFIX = "/bot/probot"
      LOG_LEVEL = "debug"
      NODE_ENV = "production"
    }
  }
}
