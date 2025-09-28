import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JiraService } from "./services/jira";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage, ServerResponse } from "http";

export class JiraMcpServer {
  private readonly server: McpServer;
  private readonly jiraService: JiraService;
  private sseTransport: SSEServerTransport | null = null;

  constructor(jiraUrl: string, username: string, apiToken: string) {
    this.jiraService = new JiraService(jiraUrl, username, apiToken);
    this.server = new McpServer({
      name: "Jira MCP Server",
      version: "0.1.0",
    });

    this.registerTools();
  }

  private registerTools(): void {
    // Tool to get issue information
    this.server.tool(
      "get_issue",
      "Get detailed information about a Jira issue",
      {
        issueKey: z
          .string()
          .describe("The key of the Jira issue to fetch (e.g., PROJECT-123)"),
      },
      async ({ issueKey }) => {
        try {
          console.log(`Fetching issue: ${issueKey}`);
          const issue = await this.jiraService.getIssue(issueKey);
          console.log(
            `Successfully fetched issue: ${issue.key} - ${issue.fields.summary}`
          );
          return {
            content: [{ type: "text", text: JSON.stringify(issue, null, 2) }],
          };
        } catch (error) {
          console.error(`Error fetching issue ${issueKey}:`, error);
          return {
            content: [{ type: "text", text: `Error fetching issue: ${error}` }],
          };
        }
      }
    );

    // Tool to get assigned issues
    this.server.tool(
      "get_assigned_issues",
      "Get issues assigned to the current user in a project",
      {
        projectKey: z
          .string()
          .optional()
          .describe("The key of the Jira project to fetch issues from"),
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
      },
      async ({ projectKey, maxResults }) => {
        try {
          console.log(
            `Fetching assigned issues${projectKey ? ` for project: ${projectKey}` : ""}`
          );
          const response = await this.jiraService.getAssignedIssues(
            projectKey,
            maxResults
          );
          console.log(
            `Successfully fetched ${response.issues.length} assigned issues`
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        } catch (error) {
          console.error(`Error fetching assigned issues:`, error);
          return {
            content: [
              {
                type: "text",
                text: `Error fetching assigned issues: ${error}`,
              },
            ],
          };
        }
      }
    );

    // Tool to get issues by type
    this.server.tool(
      "get_issues_by_type",
      "Get issues of a specific type",
      {
        issueType: z
          .string()
          .describe("The type of issue to fetch (e.g., Bug, Story, Epic)"),
        projectKey: z
          .string()
          .optional()
          .describe("The key of the Jira project to fetch issues from"),
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
      },
      async ({ issueType, projectKey, maxResults }) => {
        try {
          console.log(
            `Fetching issues of type: ${issueType}${projectKey ? ` for project: ${projectKey}` : ""}`
          );
          const response = await this.jiraService.getIssuesByType(
            issueType,
            projectKey,
            maxResults
          );
          console.log(
            `Successfully fetched ${response.issues.length} issues of type ${issueType}`
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        } catch (error) {
          console.error(`Error fetching issues by type:`, error);
          return {
            content: [
              { type: "text", text: `Error fetching issues by type: ${error}` },
            ],
          };
        }
      }
    );

    // Tool to get projects
    this.server.tool(
      "get_projects",
      "Get list of available Jira projects",
      {},
      async () => {
        try {
          console.log("Fetching projects");
          const projects = await this.jiraService.getProjects();
          console.log(`Successfully fetched ${projects.length} projects`);
          return {
            content: [
              { type: "text", text: JSON.stringify(projects, null, 2) },
            ],
          };
        } catch (error) {
          console.error("Error fetching projects:", error);
          return {
            content: [
              { type: "text", text: `Error fetching projects: ${error}` },
            ],
          };
        }
      }
    );

    // Tool to get issue types
    this.server.tool(
      "get_issue_types",
      "Get list of available Jira issue types",
      {},
      async () => {
        try {
          console.log("Fetching issue types");
          const issueTypes = await this.jiraService.getIssueTypes();
          console.log(`Successfully fetched issue types`);
          return {
            content: [
              { type: "text", text: JSON.stringify(issueTypes, null, 2) },
            ],
          };
        } catch (error) {
          console.error("Error fetching issue types:", error);
          return {
            content: [
              { type: "text", text: `Error fetching issue types: ${error}` },
            ],
          };
        }
      }
    );

    // Tool to get issues under an epic
    this.server.tool(
      "get_epic_issues",
      "Get issues under a specific epic",
      {
        epicKey: z
          .string()
          .describe(
            "The key of the epic to get issues for (e.g., PROJECT-123)"
          ),
        maxResults: z
          .number()
          .optional()
          .describe("Maximum number of results to return"),
      },
      async ({ epicKey, maxResults }) => {
        try {
          console.log(`Fetching issues under epic: ${epicKey}`);
          const response = await this.jiraService.getEpicIssues(
            epicKey,
            maxResults
          );
          console.log(
            `Successfully fetched ${response.issues.length} issues under epic ${epicKey}`
          );
          return {
            content: [
              { type: "text", text: JSON.stringify(response, null, 2) },
            ],
          };
        } catch (error) {
          console.error(`Error fetching issues under epic ${epicKey}:`, error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : JSON.stringify(error, null, 2);
          return {
            content: [
              {
                type: "text",
                text: `Error fetching issues under epic: ${errorMessage}`,
              },
            ],
          };
        }
      }
    );

    // Tool to get summary of non-DONE issues under an epic
    this.server.tool(
      "get_epic_summary",
      "Get summary of non-DONE tickets under an epic with statistics",
      {
        epicKey: z
          .string()
          .describe(
            "The key of the epic to summarize (e.g., PROJECT-123)"
          ),
      },
      async ({ epicKey }) => {
        try {
          console.log(`Fetching epic summary for: ${epicKey}`);
          const summary = await this.jiraService.getEpicSummary(epicKey);
          console.log(
            `Successfully generated summary for epic ${epicKey}: ${summary.nonDoneIssues}/${summary.totalIssues} issues remaining`
          );
          
          // Format the response for better readability
          const formattedSummary = {
            epic: {
              key: summary.epic.key,
              summary: summary.epic.fields.summary,
              status: summary.epic.fields.status.name,
            },
            statistics: {
              totalIssues: summary.totalIssues,
              doneIssues: summary.doneIssues,
              nonDoneIssues: summary.nonDoneIssues,
              unassignedIssues: summary.unassignedIssues,
              completionPercentage: summary.totalIssues > 0 ? 
                Math.round((summary.doneIssues / summary.totalIssues) * 100) : 0,
            },
            breakdown: {
              byStatus: summary.issuesByStatus,
              byType: summary.issuesByType,
              byPriority: summary.issuesByPriority,
            },
            nonDoneTickets: summary.nonDoneTickets,
          };

          return {
            content: [
              { type: "text", text: JSON.stringify(formattedSummary, null, 2) },
            ],
          };
        } catch (error) {
          console.error(`Error fetching epic summary for ${epicKey}:`, error);
          const errorMessage =
            error instanceof Error
              ? error.message
              : JSON.stringify(error, null, 2);
          return {
            content: [
              {
                type: "text",
                text: `Error fetching epic summary: ${errorMessage}`,
              },
            ],
          };
        }
      }
    );
  }

  async connect(transport: Transport): Promise<void> {
    console.log("Connecting to transport...");
    await this.server.connect(transport);
    console.log("Server connected and ready to process requests");
  }

  async startHttpServer(port: number): Promise<void> {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      console.log("New SSE connection established");
      this.sseTransport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>
      );
      await this.server.connect(this.sseTransport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
      if (!this.sseTransport) {
        res.sendStatus(400);
        return;
      }
      await this.sseTransport.handlePostMessage(
        req as unknown as IncomingMessage,
        res as unknown as ServerResponse<IncomingMessage>
      );
    });

    app.listen(port, () => {
      console.log(`HTTP server listening on port ${port}`);
      console.log(`SSE endpoint available at http://localhost:${port}/sse`);
      console.log(
        `Message endpoint available at http://localhost:${port}/messages`
      );
    });
  }
}
