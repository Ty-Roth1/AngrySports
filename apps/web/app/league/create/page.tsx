import { CreateLeagueForm } from '@/components/league/CreateLeagueForm'

export default function CreateLeaguePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Create a League</h1>
      <p className="text-gray-400 mb-8">Configure your league settings. Everything can be changed later.</p>
      <CreateLeagueForm />
    </div>
  )
}
