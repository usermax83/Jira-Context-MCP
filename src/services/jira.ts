import axios, { AxiosError } from "axios";
import {
  JiraError,
  JiraIssue,
  JiraProject,
  JiraProjectListResponse,
  JiraSearchParams,
  JiraSearchResponse,
  JiraIssueTypeResponse,
} from "~/types/jira";
import fs from "fs";

export class JiraService {
  private readonly baseUrl: string;
  private readonly auth: {
    username: string;
    password: string;
  };

  constructor(baseUrl: string, username: string, apiToken: string) {
    // Ensure the base URL doesn't end with a trailing slash
    this.baseUrl = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
    this.auth = {
      username,
      password: apiToken,
    };
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    data?: any
  ): Promise<T> {
    try {
      console.log(`Calling ${this.baseUrl}${endpoint}`);

      const config = {
        method,
        url: `${this.baseUrl}${endpoint}`,
        auth: this.auth,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        data: method === "POST" ? data : undefined,
      };

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response) {
        const errorData = error.response.data;
        console.error(
          "Jira API Error Response:",
          JSON.stringify(errorData, null, 2)
        );
        throw {
          status: error.response.status,
          err:
            (errorData as { errorMessages?: string[] })?.errorMessages?.[0] ||
            (errorData as { message?: string })?.message ||
            "Unknown error",
        } as JiraError;
      }
      throw new Error(
        `Failed to make request to Jira API: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get a Jira issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    const endpoint = `/rest/api/3/issue/${issueKey}`;
    const response = await this.request<JiraIssue>(endpoint);
    writeLogs(`jira-issue-${issueKey}.json`, response);
    return response;
  }

  /**
   * Search for Jira issues using JQL
   */
  async searchIssues(params: JiraSearchParams): Promise<JiraSearchResponse> {
    const endpoint = `/rest/api/3/search`;
    const response = await this.request<JiraSearchResponse>(
      endpoint,
      "POST",
      params
    );
    writeLogs(
      `jira-search-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
      response
    );
    return response;
  }

  /**
   * Get issues assigned to the current user
   */
  async getAssignedIssues(
    projectKey?: string,
    maxResults: number = 50
  ): Promise<JiraSearchResponse> {
    const jql = projectKey
      ? `assignee = currentUser() AND project = ${projectKey} ORDER BY updated DESC`
      : "assignee = currentUser() ORDER BY updated DESC";

    return this.searchIssues({
      jql,
      maxResults,
      fields: [
        "summary",
        "description",
        "status",
        "issuetype",
        "priority",
        "assignee",
        "project",
      ],
    });
  }

  /**
   * Get issues by type
   */
  async getIssuesByType(
    issueType: string,
    projectKey?: string,
    maxResults: number = 50
  ): Promise<JiraSearchResponse> {
    const jql = projectKey
      ? `issuetype = "${issueType}" AND project = ${projectKey} ORDER BY updated DESC`
      : `issuetype = "${issueType}" ORDER BY updated DESC`;

    return this.searchIssues({
      jql,
      maxResults,
      fields: [
        "summary",
        "description",
        "status",
        "issuetype",
        "priority",
        "assignee",
        "project",
      ],
    });
  }

  /**
   * Get list of projects
   */
  async getProjects(): Promise<JiraProject[]> {
    const endpoint = `/rest/api/3/project`;
    const response = await this.request<JiraProject[]>(endpoint);
    return response;
  }

  /**
   * Get issues under an epic
   */
  async getEpicIssues(
    epicKey: string,
    maxResults: number = 50
  ): Promise<JiraSearchResponse> {
    // JQL to find issues that are children of the epic
    // Start with parent field which is the modern approach
    const jql = `parent = "${epicKey}" ORDER BY updated DESC`;

    return this.searchIssues({
      jql,
      maxResults,
      fields: [
        "summary",
        "description", 
        "status",
        "issuetype",
        "priority",
        "assignee",
        "project",
        "parent",
      ],
    });
  }

  /**
   * Get summary of non-DONE issues under an epic
   */
  async getEpicSummary(epicKey: string): Promise<{
    epic: JiraIssue;
    totalIssues: number;
    nonDoneIssues: number;
    doneIssues: number;
    issuesByStatus: Record<string, number>;
    issuesByType: Record<string, number>;
    issuesByPriority: Record<string, number>;
    unassignedIssues: number;
    nonDoneTickets: Array<{
      key: string;
      summary: string;
      status: string;
      type: string;
      priority: string;
      assignee: string | null;
    }>;
  }> {
    // First get the epic details
    const epic = await this.getIssue(epicKey);
    
    // Get all issues under the epic (no limit to get complete picture)
    const allIssuesResponse = await this.searchIssues({
      jql: `parent = "${epicKey}" ORDER BY status ASC, priority DESC`,
      maxResults: 1000, // Large number to get all issues
      fields: [
        "summary",
        "status",
        "issuetype", 
        "priority",
        "assignee",
      ],
    });

    const issues = allIssuesResponse.issues;
    const totalIssues = issues.length;

    // Initialize counters
    const issuesByStatus: Record<string, number> = {};
    const issuesByType: Record<string, number> = {};
    const issuesByPriority: Record<string, number> = {};
    let doneIssues = 0;
    let unassignedIssues = 0;
    const nonDoneTickets: Array<{
      key: string;
      summary: string;
      status: string;
      type: string;
      priority: string;
      assignee: string | null;
    }> = [];

    // Process each issue
    issues.forEach(issue => {
      const status = issue.fields.status.name;
      const type = issue.fields.issuetype.name;
      const priority = issue.fields.priority?.name || 'None';
      const assignee = issue.fields.assignee?.displayName || null;

      // Count by status
      issuesByStatus[status] = (issuesByStatus[status] || 0) + 1;
      
      // Count by type
      issuesByType[type] = (issuesByType[type] || 0) + 1;
      
      // Count by priority
      issuesByPriority[priority] = (issuesByPriority[priority] || 0) + 1;

      // Check if done (common done status names)
      const isDone = ['Done', 'Closed', 'Resolved', 'Complete', 'Completed'].includes(status);
      
      if (isDone) {
        doneIssues++;
      } else {
        // Add to non-done tickets
        nonDoneTickets.push({
          key: issue.key,
          summary: issue.fields.summary,
          status,
          type,
          priority,
          assignee,
        });
      }

      // Count unassigned
      if (!assignee) {
        unassignedIssues++;
      }
    });

    const nonDoneIssues = totalIssues - doneIssues;

    return {
      epic,
      totalIssues,
      nonDoneIssues,
      doneIssues,
      issuesByStatus,
      issuesByType,
      issuesByPriority,
      unassignedIssues,
      nonDoneTickets,
    };
  }

  /**
   * Get list of issue types
   */
  async getIssueTypes(): Promise<JiraIssueTypeResponse> {
    const endpoint = `/rest/api/3/issuetype`;
    const response = await this.request<JiraIssueTypeResponse>(endpoint);
    return response;
  }
}

function writeLogs(name: string, value: any) {
  try {
    const logsDir = "logs";
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(`${logsDir}/${name}`, JSON.stringify(value, null, 2));
  } catch (error) {
    console.warn(`Failed to write log file ${name}:`, error);
  }
}
