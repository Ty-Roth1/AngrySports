'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const nav = [
    { label: 'Dashboard', href: '/dashboard', icon: '⚾' },
    { label: 'Players',   href: '/players',   icon: '🔍' },
  ]

  return (
    <aside className={`flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 ${collapsed ? 'w-12' : 'w-44'}`}>
      {/* Header */}
      <div className={`flex items-center border-b border-gray-800 ${collapsed ? 'justify-center p-3' : 'justify-between p-4'}`}>
        {!collapsed && (
          <Link href="/dashboard">
            <span
              className="text-xl font-bold text-white tracking-widest"
              style={{ fontFamily: 'var(--font-orbitron)' }}
            >
              12AM
            </span>
          </Link>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="text-gray-500 hover:text-white transition-colors p-1 rounded"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {nav.map(item => {
          const active = item.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 py-2.5 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'px-4'} ${
                active
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
