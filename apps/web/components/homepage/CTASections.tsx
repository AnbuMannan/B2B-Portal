'use client'

import Link from 'next/link'

export default function CTASections() {
  return (
    <section className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-900 py-16 text-white sm:py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h3 className="text-3xl font-bold sm:text-4xl">Ready to Grow Your Business?</h3>
        <p className="mt-4 text-lg text-blue-100">
          Join thousands of Indian businesses already scaling with verified sellers and active buyers on our platform.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
          <Link href="/seller/signup">
            <button className="w-full rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-700 shadow-md transition hover:bg-gray-100 sm:w-auto">
              Start Selling
            </button>
          </Link>
          <Link href="/buyer/signup">
            <button className="w-full rounded-lg border border-white px-8 py-4 text-base font-semibold text-white transition hover:bg-white/10 sm:w-auto">
              Post Your Requirement
            </button>
          </Link>
        </div>
      </div>
    </section>
  )
}