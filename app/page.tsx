import { redirect } from 'next/navigation'

export default function Home() {
  // For now, redirect to login - later we'll check auth status
  redirect('/login')
}