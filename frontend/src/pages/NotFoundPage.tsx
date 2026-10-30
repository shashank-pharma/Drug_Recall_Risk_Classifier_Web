import { Link } from 'react-router'
import { PageHeader } from '@/components/PageHeader'

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" description="This page doesn't exist." />
      <Link to="/" className="text-sm underline underline-offset-4">
        Go to New recall
      </Link>
    </>
  )
}
