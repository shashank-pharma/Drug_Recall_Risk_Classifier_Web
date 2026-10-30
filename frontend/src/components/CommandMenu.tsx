import { useQuery } from '@tanstack/react-query'
import { AlarmClock, FilePlus2, History, LayoutDashboard, Network, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { ClassBadge } from '@/components/ClassBadge'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command'
import { api } from '@/lib/api'

const PAGES = [
  { label: 'New recall', to: '/', icon: FilePlus2 },
  { label: 'History', to: '/history', icon: History },
  { label: 'Overdue recalls', to: '/history?status=overdue', icon: AlarmClock },
  { label: 'Recall explorer', to: '/explorer', icon: Network },
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
]

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const SHORTCUT = isMac ? '⌘K' : 'Ctrl K'

/** Cmd/Ctrl+K: jump to a page or find a recall by drug name or batch ID (plain search, no AI). */
export function CommandMenu() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 200)
    return () => clearTimeout(timer)
  }, [text])

  const recalls = useQuery({
    queryKey: ['command-search', search],
    queryFn: () => api.listRecalls({ q: search, page_size: 8 }),
    enabled: open && search.length >= 2,
  })

  function go(to: string) {
    setOpen(false)
    setText('')
    navigate(to)
  }

  // The list comes from the server, so cmdk's own filtering is off; pages are filtered here.
  const needle = text.trim().toLowerCase()
  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(needle))
  const found = search.length >= 2 ? (recalls.data?.items ?? []) : []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
        className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden sm:inline">Search recalls</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-sans text-xs sm:inline">{SHORTCUT}</kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Find a recall by drug name or batch ID, or go to a page."
      >
        <Command shouldFilter={false}>
          <CommandInput placeholder="Drug name, batch ID or page…" value={text} onValueChange={setText} />
          <CommandList>
            <CommandEmpty>
              {search.length >= 2 && recalls.isFetching
                ? 'Searching…'
                : needle.length >= 2
                  ? `No pages or recalls match "${text.trim()}".`
                  : 'Type at least 2 characters to search recalls.'}
            </CommandEmpty>
            {found.length > 0 && (
              <CommandGroup heading="Recalls">
                {found.map((r) => (
                  <CommandItem key={r.id} value={`recall-${r.id}`} onSelect={() => go(`/recalls/${r.id}`)}>
                    <ClassBadge label={r.recall_class} />
                    <span className="font-medium">{r.drug_name}</span>
                    <span className="text-muted-foreground">{r.batch_id}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map(({ label, to, icon: Icon }) => (
                  <CommandItem key={to} value={`page-${to}`} onSelect={() => go(to)}>
                    <Icon aria-hidden />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
        <p className="border-t px-3 py-2 text-xs text-muted-foreground">
          <CommandShortcut className="ml-0">↑↓</CommandShortcut> to move · Enter to open · Esc to close
        </p>
      </CommandDialog>
    </>
  )
}
