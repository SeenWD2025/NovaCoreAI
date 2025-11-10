# GitHub Repository Secrets Setup

This document lists all the secrets required for the CI/CD workflows to function properly.

## Required Secrets

### Terraform Infrastructure (Optional - only needed for infrastructure deployment)

The Terraform job in the CI/CD pipeline requires the following secrets to manage infrastructure:

1. **DO_TOKEN**
   - Description: DigitalOcean API token for managing infrastructure resources
   - Required for: Terraform plan/apply operations
   - How to obtain: Generate from DigitalOcean Console → API → Tokens/Keys

2. **DO_SPACES_ACCESS_KEY**
   - Description: DigitalOcean Spaces access key for Terraform state storage
   - Required for: Terraform backend (S3-compatible storage)
   - How to obtain: Generate from DigitalOcean Console → API → Spaces Keys

3. **DO_SPACES_SECRET_KEY**
   - Description: DigitalOcean Spaces secret key for Terraform state storage
   - Required for: Terraform backend (S3-compatible storage)
   - How to obtain: Generate from DigitalOcean Console → API → Spaces Keys

### Deployment Secrets (Optional - only needed for deployment jobs)

4. **SSH_PRIVATE_KEY**
   - Description: SSH private key for accessing production servers
   - Required for: Production deployment job

5. **KNOWN_HOSTS**
   - Description: SSH known hosts for production servers
   - Required for: Production deployment job

6. **PRODUCTION_HOST**
   - Description: Hostname or IP of production server
   - Required for: Production deployment job

7. **PRODUCTION_USER**
   - Description: SSH username for production server
   - Required for: Production deployment job

8. **STAGING_SSH_PRIVATE_KEY**
   - Description: SSH private key for accessing staging servers
   - Required for: Staging deployment job

9. **STAGING_KNOWN_HOSTS**
   - Description: SSH known hosts for staging servers
   - Required for: Staging deployment job

10. **STAGING_HOST**
    - Description: Hostname or IP of staging server
    - Required for: Staging deployment job

11. **STAGING_USER**
    - Description: SSH username for staging server
    - Required for: Staging deployment job

## How to Add Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## Notes

- The Terraform job will be skipped if the required secrets are not configured
- The test job does not require any secrets and should work out of the box
- The build job only requires secrets for pushing Docker images to the registry
- Deployment jobs are conditional and only run on main/develop branches
