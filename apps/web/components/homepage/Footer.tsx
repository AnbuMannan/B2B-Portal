'use client'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center">
              <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
                <span className="font-bold text-white">B2B</span>
              </div>
              <span className="text-xl font-bold">B2B Portal</span>
            </div>

            <p className="mb-6 max-w-md text-gray-400">
              Connecting businesses across India with verified GST, IEC, and MSME sellers. Find trusted suppliers,
              negotiate confidently, and grow your B2B network.
            </p>

            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-400 transition-colors hover:text-white"
                aria-label="Visit our Facebook page"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073C0 18.063 4.388 23.027 10.125 23.927V15.542H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.063 24 12.073z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 transition-colors hover:text-white"
                aria-label="Visit our Twitter profile"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417A9.867 9.867 0 011.5 21.53a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 transition-colors hover:text-white"
                aria-label="Visit our LinkedIn profile"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9H12.765V10.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433A2.062 2.062 0 013.274 5.37 2.064 2.064 0 115.337 7.433zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-gray-400 transition-colors hover:text-white"
                aria-label="Visit our Instagram profile"
              >
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 6.624 5.367 11.99 11.988 11.99s11.987-5.366 11.987-11.99C24.014 5.367 18.641.001 12.017.001zM8.449 16.988a3.998 3.998 0 01-3.998-3.999 3.999 3.999 0 113.998 3.999zm7.586-7.36a1.334 1.334 0 11-1.334-1.334 1.335 1.335 0 011.334 1.334zm2.177 7.36a3.999 3.999 0 01-7.997 0v-2.037h1.999v2.037a2 2 0 003.999 0V9.734h1.999z" />
                </svg>
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/about" className="text-gray-400 transition-colors hover:text-white">
                  About Us
                </a>
              </li>
              <li>
                <a href="/blog" className="text-gray-400 transition-colors hover:text-white">
                  Blog
                </a>
              </li>
              <li>
                <a href="/contact" className="text-gray-400 transition-colors hover:text-white">
                  Contact
                </a>
              </li>
              <li>
                <a href="/careers" className="text-gray-400 transition-colors hover:text-white">
                  Careers
                </a>
              </li>
              <li>
                <a href="/help" className="text-gray-400 transition-colors hover:text-white">
                  Help Center
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-lg font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/terms" className="text-gray-400 transition-colors hover:text-white">
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/privacy" className="text-gray-400 transition-colors hover:text-white">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/cookie" className="text-gray-400 transition-colors hover:text-white">
                  Cookie Policy
                </a>
              </li>
              <li>
                <a href="/gdpr" className="text-gray-400 transition-colors hover:text-white">
                  GDPR Compliance
                </a>
              </li>
              <li>
                <a href="/grievance" className="text-gray-400 transition-colors hover:text-white">
                  Grievance Officer
                </a>
              </li>
            </ul>
          </div>

          <div />
        </div>

        <div className="mt-8 flex flex-col items-center justify-between border-t border-gray-800 pt-8 text-sm text-gray-400 md:flex-row">
          <p>© {year} B2B Portal. All rights reserved.</p>
          <div className="mt-4 flex items-center space-x-6 md:mt-0">
            <div className="flex items-center space-x-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span>SSL Secured</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500">
                <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span>GDPR Compliant</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-gray-800 p-4 text-sm text-gray-400">
          <h4 className="mb-2 font-semibold text-white">Grievance Officer</h4>
          <p className="mb-2">
            For any complaints or grievances, please contact our designated officer as per the IT Act, 2000:
          </p>
          <p>Email: grievance@b2bportal.com | Phone: +91-XXX-XXXX-XXXX</p>
        </div>
      </div>
    </footer>
  )
}