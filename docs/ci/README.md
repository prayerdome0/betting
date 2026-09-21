# Enable the verification workflow

`verify.yml.example` is an inactive GitHub Actions template, not an installed workflow. It is preserved here because the GitHub App used to submit this branch does not have permission to create or update workflows.

An authorized maintainer can activate it with:

```bash
mkdir -p .github/workflows
cp docs/ci/verify.yml.example .github/workflows/verify.yml
```

Review and commit the resulting workflow using a GitHub identity with workflow-write permission. Until then, no automatic CI checks are installed by this PR; run the commands in the root README manually.

The template uses isolated Firebase emulators, not production Firebase credentials. Authenticated integration and browser tests have not been executed in the development sandbox, and no remote CI run has been verified.
