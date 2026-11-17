Agent Development and Remote Testing Rules

1. Core Principles

All development must follow a feature-branch workflow.

Local machine is for development; GitHub Actions is for full testing.

- Develop exclusively on feature branches.
- Never develop directly on "main", "master", or protected branches.
- Run only lightweight tests locally.
- Push code to GitHub for full testing.
- GitHub Actions is the authoritative source of full test results.
- Do not claim that tests pass without verified results from GitHub Actions.

2. Branch Management

Before starting development:

1. Check the current Git branch and working tree.
2. Update the base branch from the remote.
3. Create or switch to a dedicated feature branch.

Branch naming convention:

- "feature/<description>"
- "fix/<description>"
- "refactor/<description>"
- "test/<description>"

Example:

git fetch origin
git switch -c feature/user-authentication origin/main

If already on an existing feature branch, continue using it.

Never:

- Commit directly to "main" or "master".
- Force-push shared branches.
- Merge a feature branch before its GitHub Actions run has passed (see Section 10).
- Overwrite unrelated user changes.

3. Local Testing

Local testing must remain lightweight to minimize CPU, memory, and disk usage.

Allowed local checks:

- Formatting checks
- ESLint or equivalent lint checks
- Type checking
- Fast unit tests
- Static analysis
- Basic code validation

Examples:

npm run lint
npm run typecheck
npm run test:unit -- --run

Use the commands supported by the current project.

Do NOT run locally unless explicitly requested:

- Full production builds
- Full unit test suites
- Integration tests
- End-to-end tests
- Playwright browser tests
- Full Docker builds
- Resource-intensive test suites

If a lightweight test is unavailable, do not invent a replacement. Record the limitation and rely on remote testing.

4. Remote Testing Through GitHub Actions

All comprehensive testing must run remotely through GitHub Actions.

After completing a logical development milestone:

1. Review the changes.
2. Run lightweight local tests.
3. Inspect "git diff" and "git status".
4. Commit the changes.
5. Push the feature branch to GitHub.
6. Trigger the appropriate GitHub Actions workflow, or use the repository's automatic push-triggered workflow.
7. Wait for the remote workflow to finish.
8. Retrieve and inspect the complete test result.

Example:

git add <relevant-files>
git commit -m "feat: implement user authentication"
git push -u origin HEAD

gh run list --branch "$(git branch --show-current)" --limit 5

If the workflow is not automatically triggered:

gh workflow run remote-test.yml \
  --ref main \
  -f target_ref="$(git branch --show-current)"

Use the actual workflow name and inputs defined by the repository.

5. Remote Test Requirements

GitHub Actions should perform the project's comprehensive test pipeline, including applicable checks:

- Dependency installation
- Full unit tests
- Integration tests
- Type checking
- Production build
- End-to-end tests
- Browser tests
- Coverage generation

Do not assume that every project has all these test types. Follow its existing test configuration.

The remote workflow must test the exact commit SHA pushed by the Agent.

Download and inspect relevant artifacts when available:

- Test logs
- JUnit reports
- Coverage reports
- Playwright HTML reports
- Screenshots
- Execution traces

6. Failure Handling

If GitHub Actions fails:

1. Retrieve the workflow logs.
2. Identify the failing job and test.
3. Determine whether the failure is caused by:
   - Application code
   - Test code
   - Dependencies
   - CI configuration
   - Remote environment
4. Fix the underlying problem.
5. Run lightweight local checks.
6. Commit and push the fix.
7. Trigger another remote test run.
8. Wait for the new run to complete.

Do not repeatedly retry without understanding the failure.

Infrastructure failures may be retried when appropriate.

Never report a failed or incomplete workflow as successful.

7. Test Completion Criteria

A development task is considered fully tested only when:

- The feature branch is pushed to GitHub.
- GitHub Actions has completed successfully.
- The tested commit SHA matches the latest intended feature commit.
- All required jobs have passed.
- No required tests have been skipped unexpectedly.

If any required check fails, the task remains incomplete.

If testing cannot be completed, explicitly report the reason.

8. GitHub Actions Monitoring

Use GitHub CLI ("gh") to monitor remote execution.

gh run list --branch "$(git branch --show-current)" --limit 5

Inspect a specific run:

gh run view <RUN_ID>
gh run view <RUN_ID> --log-failed

Wait for completion:

gh run watch <RUN_ID> --exit-status

Download artifacts:

gh run download <RUN_ID> --dir ./remote-test-results

Always associate results with the exact commit SHA.

9. Commit and Push Policy

Use meaningful conventional commit messages:

- "feat:"
- "fix:"
- "refactor:"
- "test:"
- "docs:"
- "chore:"

Push feature branches regularly to ensure remote testing can start early.

Do not push unrelated files, local build artifacts, secrets, credentials, or temporary test data.

Never force-push unless explicitly authorized.

10. Merge to Master and Delete the Branch

Once the remote workflow for the latest feature commit has passed, finish the
task by merging the feature branch into "master" and deleting the branch.
This is the default end state of every development task; no separate
authorization is needed after a green run.

Steps:

1. Confirm the run for the exact pushed SHA is green (Section 7).
2. Update the base branch from the remote.
3. Merge the feature branch into "master".
4. Push "master".
5. Verify the merge commit in "master" contains the tested feature commit.
6. Delete the local feature branch.
7. Delete the remote feature branch.
8. Switch back to "master" and pull.

Example:

git fetch origin
git switch master
git pull --ff-only origin master
git merge --no-ff feature/<description>
git push origin master

git branch -d feature/<description>
git push origin --delete feature/<description>

git switch master
git pull --ff-only origin master

Rules:

- Only merge after GitHub Actions has passed for the latest feature commit.
  A failing, cancelled, in-progress or superseded run is not a green run.
- Never merge by force-pushing "master".
- If the merge conflicts, resolve it on a new feature branch and repeat the
  remote test cycle; do not hand-resolve conflicts directly on "master".
- If the merge reintroduces changes that the remote run did not cover, push the
  merge commit and wait for its workflow before reporting completion.
- If the remote branch cannot be deleted, report it rather than leaving the
  task silently half-finished.
- Record the master merge commit SHA together with the tested feature SHA.

11. Final Response

At the end of each development task, report:

1. Feature branch name.
2. Summary of implemented changes.
3. Local lightweight tests executed and their results.
4. GitHub Actions Run URL.
5. Tested commit SHA.
6. Full remote test results.
7. Master merge commit SHA, and confirmation that the feature branch (local and
   remote) was deleted.
8. Any remaining failures or limitations.

Clearly distinguish:

- Local tests passed
- Remote tests passed
- Remote tests failed
- Remote tests pending

Final rule: Never consider development complete merely because the code works
locally. Full verification must be completed by GitHub Actions, and the branch
must be merged into "master" and deleted once that verification passes.