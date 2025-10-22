import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import type { ModelSettings } from "@shared/schema";

export default function Settings() {
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [formData, setFormData] = useState({
    provider: "ollama",
    modelName: "",
    endpoint: "",
    apiKey: "",
    isDefault: "false",
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: modelSettings, isLoading } = useQuery<ModelSettings[]>({
    queryKey: ["/api/model-settings"],
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/model-settings", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Model Added",
        description: "New model configuration has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/model-settings"] });
      setIsAddingModel(false);
      setFormData({
        provider: "ollama",
        modelName: "",
        endpoint: "",
        apiKey: "",
        isDefault: "false",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to Add Model",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ModelSettings> }) => {
      const response = await apiRequest("PATCH", `/api/model-settings/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Model Updated",
        description: "Model configuration has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/model-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Update Model",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/model-settings/${id}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Model Deleted",
        description: "Model configuration has been removed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/model-settings"] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Delete Model",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.provider || !formData.modelName) {
      toast({
        title: "Validation Error",
        description: "Provider and Model Name are required",
        variant: "destructive",
      });
      return;
    }
    createModelMutation.mutate(formData);
  };

  const handleSetDefault = (id: string) => {
    updateModelMutation.mutate({ id, updates: { isDefault: "true" } });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-2">Configure LLM models for automated remediation</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Model Configurations</CardTitle>
              <Button
                onClick={() => setIsAddingModel(!isAddingModel)}
                data-testid="button-add-model"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Model
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isAddingModel && (
              <form onSubmit={handleSubmit} className="bg-slate-50 p-6 rounded-lg mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) => setFormData({ ...formData, provider: value })}
                    >
                      <SelectTrigger id="provider" data-testid="select-provider">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ollama">Ollama (Local)</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="custom">Custom Endpoint</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="modelName">Model Name</Label>
                    <Input
                      id="modelName"
                      data-testid="input-model-name"
                      placeholder="e.g., llama3.2:3b, gpt-4, claude-3-sonnet"
                      value={formData.modelName}
                      onChange={(e) => setFormData({ ...formData, modelName: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="endpoint">Endpoint URL</Label>
                    <Input
                      id="endpoint"
                      data-testid="input-endpoint"
                      placeholder="http://localhost:11434 (for Ollama)"
                      value={formData.endpoint}
                      onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="apiKey">API Key (if required)</Label>
                    <Input
                      id="apiKey"
                      data-testid="input-api-key"
                      type="password"
                      placeholder="Optional for local models"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <Button type="submit" disabled={createModelMutation.isPending} data-testid="button-save-model">
                    {createModelMutation.isPending ? "Saving..." : "Save Model"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsAddingModel(false)}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {isLoading ? (
              <div className="text-center py-8 text-slate-600">Loading models...</div>
            ) : !modelSettings || modelSettings.length === 0 ? (
              <div className="text-center py-8">
                <i className="fas fa-robot text-slate-400 text-4xl mb-4"></i>
                <p className="text-slate-600">No models configured yet</p>
                <p className="text-sm text-slate-500 mt-2">Add a model to enable automated issue remediation</p>
              </div>
            ) : (
              <div className="space-y-4">
                {modelSettings.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                    data-testid={`model-card-${model.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-slate-900">{model.modelName}</h3>
                        {model.isDefault === "true" && (
                          <span className="px-2 py-1 bg-brand-500 text-white text-xs rounded-full">
                            Default
                          </span>
                        )}
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                          {model.provider}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {model.endpoint || "Using default endpoint"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {model.isDefault !== "true" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(model.id)}
                          data-testid={`button-set-default-${model.id}`}
                        >
                          Set as Default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModelMutation.mutate(model.id)}
                        disabled={deleteModelMutation.isPending}
                        data-testid={`button-delete-${model.id}`}
                      >
                        <i className="fas fa-trash text-red-600"></i>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Start Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm text-slate-700">
              <div>
                <h4 className="font-semibold mb-2">1. Using Ollama (Local Models)</h4>
                <p className="text-slate-600 mb-2">Install Ollama and pull a model:</p>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded">
{`# Install Ollama from ollama.com
# Pull a model
ollama pull llama3.2:3b
ollama serve`}
                </pre>
                <p className="text-slate-600 mt-2">Then add: <code className="bg-slate-100 px-1 rounded">http://localhost:11434</code></p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">2. Using OpenAI</h4>
                <p className="text-slate-600">Enter your OpenAI API key and model name (e.g., gpt-4, gpt-3.5-turbo)</p>
              </div>

              <div>
                <h4 className="font-semibold mb-2">3. Using Anthropic</h4>
                <p className="text-slate-600">Enter your Anthropic API key and model name (e.g., claude-3-sonnet-20240229)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
