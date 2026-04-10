import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-8">Create your account</h1>
        <SignupForm />
      </div>
    </main>
  )
}
