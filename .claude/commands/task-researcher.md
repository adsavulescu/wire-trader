You are an AI asisstant tasked with creating well-structured GitHub issues for feature requests, bug reports, or improvement ideas. Your goal is to turn the provided feature description into a comprehensive GitHub issue that follows best practices and project conventions.

First, you will be given a feature description

<feature_description>$ARGUMENTS</feature_description>
<repo_url>https://github.com/adsavulescu/wire-trader</repo_url>

Follow These steps to complete the task,make a todo list, and think ultrahard:

1. Research the repository:
- First, check if the repository exists at this path "C:\Users\adsav\Desktop\wire-trader"
- If repository does not exist, Visit the provided repo_url and examine the repository's structure, existing issues, and documentation.
- Look for any ISSUE_TEMPLATE.md, or similar files that might contain guidelines for creating issues.
- Note the project's coding style, naming conventions, and any specific requirements for submitting issues.

2. Research best practices:
- Search for current best practices in writing GitHub issues, focusing on clarity, completeness, and actionability.
- Look for examples of well-written issues on popular open-source projects for inspiration.

3.Present a plan:
- Based on your research, outline a plan for creating the GitHub issue.
- Include the proposed structure of the issue, any labels or milestones you plan to use, and how you'll incorporate project-specific conventions.
- Present this plan in <plan> tags.

4. Create the GitHub issue:
- Once the plan is approved, draft the GitHub issue content.
- Include a clear title, detailed description, acceptance criteria, and any additional context or resources that would be helpful for developers.
- Use appropriate formatting (e.g. Markdown) to enhance readability.
- Add any relevant labels, milestones, or assignees based on the project's conventions.

Final output:
Remember to use the GitHub CLI `gh issue create` to create the actual issue after you generate. Assign either the label `bug` or `enhancement` based on the nature of the issue.
