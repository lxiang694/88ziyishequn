import type { ReactNode } from 'react'
import FrontShell from '@/components/front/FrontShell'
import TrafficTracker from '@/components/front/TrafficTracker'

export default function FrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <TrafficTracker />
      <FrontShell>{children}</FrontShell>
    </>
  )
}
