import React from "react";
import { useGetTask, getGetTaskQueryKey } from "@workspace/api-client-react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TaskDetail() {
  const [, params] = useRoute("/tasks/:id");
  const id = params?.id || "";
  
  const { data: task, isLoading } = useGetTask(id, {
    query: { enabled: !!id, queryKey: getGetTaskQueryKey(id) }
  });

  if (isLoading) {
    return <div className="p-8 text-center animate-pulse">Loading task details...</div>;
  }

  if (!task) {
    return <div className="p-8 text-center text-muted-foreground">Task not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
          <p className="text-muted-foreground mt-1">Project: {task.projectName || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize px-3 py-1 text-sm">{task.priority}</Badge>
          <Badge className="capitalize px-3 py-1 text-sm">{task.status.replace("_", " ")}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {task.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">{task.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <div className="text-sm text-muted-foreground">Assignee</div>
                <div className="font-medium">{task.assigneeName || "Unassigned"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Due Date</div>
                <div className="font-medium">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="font-medium">{new Date(task.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            {task.comments && task.comments.length > 0 ? (
              <div className="space-y-4">
                {task.comments.map((comment) => (
                  <div key={comment.id} className="bg-muted p-3 rounded-lg text-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{comment.userName || "User"}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-foreground/80">{comment.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">No comments yet</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
