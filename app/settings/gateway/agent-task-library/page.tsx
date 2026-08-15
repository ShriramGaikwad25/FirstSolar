"use client";

import { useMemo, useState } from "react";
import { useRightSidebar } from "@/contexts/RightSidebarContext";
import { AGENT_TASKS, type AgentTask, type AgentTaskDomain as TaskDomain, type AgentTaskExecutionType as ExecutionType } from "@/lib/agent-task-library";

const TASKS: AgentTask[] = AGENT_TASKS;

function domainPillClass(domain: TaskDomain) {
  if (domain === "User") return "bg-blue-100 text-blue-800";
  if (domain === "Application") return "bg-purple-100 text-purple-700";
  return "bg-green-100 text-green-700";
}

function execPillClass(exec: ExecutionType) {
  if (exec === "LLM") return "bg-purple-100 text-purple-700";
  if (exec === "ML Algorithm") return "bg-amber-100 text-amber-700";
  return "bg-blue-100 text-blue-700";
}

export default function AgentTaskLibraryPage() {
  const { openSidebar } = useRightSidebar();
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [execFilter, setExecFilter] = useState("");

  const stats = useMemo(() => {
    const llm = TASKS.filter((t) => t.exec === "LLM").length;
    const ml = TASKS.filter((t) => t.exec === "ML Algorithm").length;
    const workflow = TASKS.filter((t) => t.exec === "Deterministic").length;
    return { total: TASKS.length, llm, ml, workflow };
  }, []);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TASKS.filter((t) => {
      const haystack = [t.id, t.name, t.domain, t.exec, t.primary, t.description, ...t.inputs]
        .join(" ")
        .toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesDomain = !domainFilter || t.domain === domainFilter;
      const matchesExec = !execFilter || t.exec === execFilter;
      return matchesSearch && matchesDomain && matchesExec;
    });
  }, [search, domainFilter, execFilter]);

  const openTaskDetail = (task: AgentTask) => {
    const TaskDetail = () => (
      <div>
        <p className="text-sm text-gray-500 mb-4 leading-relaxed">{task.description}</p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Task ID</div>
            <div className="text-sm font-semibold text-gray-900">{task.id}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Task Domain</div>
            <div className="text-sm font-semibold text-gray-900">{task.domain}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Execution Type</div>
            <div className="text-sm font-semibold text-gray-900">{task.exec}</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Version</div>
            <div className="text-sm font-semibold text-gray-900">{task.version}</div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Input Parameters / Signals</h3>
          <div className="flex flex-wrap gap-2">
            {task.inputs.map((input) => (
              <span
                key={input}
                className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-700"
              >
                {input}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Output Schema</h3>
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,2fr)] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <div className="px-3 py-2.5">Field</div>
              <div className="px-3 py-2.5">Type</div>
              <div className="px-3 py-2.5">Description</div>
            </div>
            <div className="divide-y divide-gray-100">
              {task.schema.map((row) => (
                <div
                  key={row.field}
                  className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,2fr)]"
                >
                  <div className="px-3 py-2.5 text-sm">
                    <div className="font-semibold text-gray-900 break-words">{row.field}</div>
                    {row.field === "confidence_score" && (
                      <div className="text-xs font-semibold text-red-600">required</div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 text-sm text-gray-700">{row.type}</div>
                  <div className="px-3 py-2.5 text-sm text-gray-700">{row.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );

    openSidebar(<TaskDetail />, { title: task.name, widthPx: 560 });
  };

  return (
    <div className="h-full">
      <div className="w-full px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Agent Task Library</h1>
          </div>
          <span className="shrink-0 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            View-only library
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Total Agent Tasks</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="mt-1 text-xs text-gray-500">Curated platform tasks</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">LLM Tasks</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.llm}</div>
            <div className="mt-1 text-xs text-gray-500">Generation / reasoning tasks</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">ML Tasks</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.ml}</div>
            <div className="mt-1 text-xs text-gray-500">Scoring / anomaly detection</div>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-gray-500">Deterministic</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{stats.workflow}</div>
            <div className="mt-1 text-xs text-gray-500">Deterministic orchestration</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border border-gray-200 rounded-lg bg-white shadow-sm p-4 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by task, signal, or output..."
            className="flex-1 min-w-[260px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All task domains</option>
              <option>User</option>
              <option>Application</option>
              <option>Account</option>
            </select>
            <select
              value={execFilter}
              onChange={(e) => setExecFilter(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All execution types</option>
              <option>LLM</option>
              <option>ML Algorithm</option>
              <option>Deterministic</option>
            </select>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Agent Task</th>
                  <th className="px-4 py-3">Task Domain</th>
                  <th className="px-4 py-3">Execution Type</th>
                  <th className="px-4 py-3">Primary Output</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => openTaskDetail(task)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 align-top max-w-[420px]">
                      <div className="text-sm font-semibold text-gray-900">{task.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{task.description}</div>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${domainPillClass(
                          task.domain
                        )}`}
                      >
                        {task.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${execPillClass(
                          task.exec
                        )}`}
                      >
                        {task.exec}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-gray-700">{task.primary}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        {task.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredTasks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                      No agent tasks match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
