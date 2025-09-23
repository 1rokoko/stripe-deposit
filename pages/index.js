import { useState, useEffect } from 'react'
import Head from 'next/head'

export default function Home() {
  const [deposits, setDeposits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDeposits()
  }, [])

  const fetchDeposits = async () => {
    try {
      const response = await fetch('/api/deposits')
      const data = await response.json()
      setDeposits(data.deposits || [])
    } catch (error) {
      console.error('Error fetching deposits:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Stripe Deposit Manager</title>
        <meta name="description" content="Manage your Stripe deposits" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Stripe Deposit Manager
            </h1>
            <p className="mt-2 text-gray-600">
              Manage and track your Stripe deposits
            </p>
          </div>

          {loading ? (
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-2 text-gray-600">Loading deposits...</p>
            </div>
          ) : (
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Recent Deposits</h2>
              </div>
              <div className="p-6">
                {deposits.length === 0 ? (
                  <p className="text-gray-500 text-center">No deposits found</p>
                ) : (
                  <div className="space-y-4">
                    {deposits.map((deposit, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium">${deposit.amount}</p>
                            <p className="text-sm text-gray-500">{deposit.status}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              {new Date(deposit.created).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
