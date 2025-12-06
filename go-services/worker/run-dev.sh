#!/bin/bash
# Load environment variables from root .env file
set -a
source ../../.env
set +a

# Run the worker service
go run .
