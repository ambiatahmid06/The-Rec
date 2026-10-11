import { ChartColumn } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'

export function Stats() {
  return (
    <>
      <PageHeader title="Stats" />
      <EmptyState
        icon={ChartColumn}
        title="No stats yet"
        message="Leaderboards and player stats show up once your group has played some games."
      />
    </>
  )
}
