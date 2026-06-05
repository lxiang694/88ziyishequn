import type { ReactNode } from 'react'
import FrontShell from '@/components/front/FrontShell'

export default function FrontLayout({ children }: { children: ReactNode }) {
  return <FrontShell>{children}</FrontShell>
}
