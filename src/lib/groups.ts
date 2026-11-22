import type { Group } from '../types'

/** The id plus every descendant id of a group. */
export function subtreeIds(groups: Group[], rootId: string): Set<string> {
  const ids = new Set([rootId])
  let grew = true
  while (grew) {
    grew = false
    for (const c of groups) {
      if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
        ids.add(c.id)
        grew = true
      }
    }
  }
  return ids
}

/** ["Personal", "Banking"] style path for a group. */
export function groupPath(groups: Group[], id: string | null): string[] {
  const path: string[] = []
  let current = groups.find((c) => c.id === id)
  while (current) {
    path.unshift(current.name)
    const parentId: string | null = current.parentId
    current = groups.find((c) => c.id === parentId)
  }
  return path
}
