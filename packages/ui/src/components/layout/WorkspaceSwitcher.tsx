/**
 * Workspace switcher dropdown.
 *
 * Allows filtering by project root in workspace mode.
 * Hidden when only one project is in the workspace.
 */

import { useWorkspaceStore } from '@/stores/workspaceStore';

export function WorkspaceSwitcher() {
  const { workspace, activeProjectRoot, setActiveProject } = useWorkspaceStore();

  if (!workspace || workspace.projects.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="workspace-switcher" className="text-sm text-gray-600">
        Project:
      </label>
      <select
        id="workspace-switcher"
        value={activeProjectRoot ?? 'all'}
        onChange={(e) => setActiveProject(e.target.value === 'all' ? null : e.target.value)}
        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="all">All Projects ({workspace.projects.length})</option>
        {workspace.projects.map((project) => (
          <option key={project.root} value={project.root}>
            {project.root.split('/').pop() || project.root}
          </option>
        ))}
      </select>
    </div>
  );
}
