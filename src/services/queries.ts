/**
 * TanStack Query hooks over the API. UI code talks to the backend only through these
 * (and the vault, for sign-in). Mutations write the server's response straight into the
 * query cache instead of refetching.
 *
 * The cache holds ciphertext only. It is cleared whenever the vault locks or signs out.
 */
import { QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Account, AccountInput, CreateGroupInput, Group, UpdateGroupInput } from '../types'
import { api } from './http'

export const queryKeys = {
  groups: ['groups'] as const,
  accounts: ['accounts'] as const,
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
  })
}

/* ---------- Queries ---------- */

export const useGroups = () => useQuery({ queryKey: queryKeys.groups, queryFn: async () => (await api.listGroups()).data })

export const useAccounts = () => useQuery({ queryKey: queryKeys.accounts, queryFn: async () => (await api.listAccounts()).data })

/* ---------- Cache helpers ---------- */

const upsert = <T extends { id: string }>(list: T[] | undefined, item: T, prepend = false) => {
  if (!list) return list
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : prepend ? [item, ...list] : [...list, item]
}

/* ---------- Account mutations (inputs are already encrypted) ---------- */

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AccountInput) => (await api.createAccount(input)).data,
    onSuccess: (account) => qc.setQueryData<Account[]>(queryKeys.accounts, (list) => upsert(list, account, true)),
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<AccountInput> }) => (await api.updateAccount(id, input)).data,
    onSuccess: (account) => qc.setQueryData<Account[]>(queryKeys.accounts, (list) => upsert(list, account)),
  })
}

export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAccount(id),
    onSuccess: (_, id) => qc.setQueryData<Account[]>(queryKeys.accounts, (list) => list?.filter((a) => a.id !== id)),
  })
}

/* ---------- Group mutations ---------- */

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateGroupInput) => (await api.createGroup(input)).data,
    onSuccess: (group) => qc.setQueryData<Group[]>(queryKeys.groups, (list) => upsert(list, group)),
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateGroupInput }) => (await api.updateGroup(id, input)).data,
    onSuccess: (group) => qc.setQueryData<Group[]>(queryKeys.groups, (list) => upsert(list, group)),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.deleteGroup(id)).data,
    onSuccess: (result) => {
      const deleted = new Set(result.deletedGroupIds)
      const moved = new Set(result.movedAccountIds)
      qc.setQueryData<Group[]>(queryKeys.groups, (list) => list?.filter((g) => !deleted.has(g.id)))
      qc.setQueryData<Account[]>(queryKeys.accounts, (list) =>
        list?.map((a) => (moved.has(a.id) ? { ...a, groupId: result.movedTo } : a)),
      )
    },
  })
}
