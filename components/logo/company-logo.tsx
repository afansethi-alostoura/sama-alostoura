import Image from 'next/image'

export function CompanyLogo() {
  return (
    <div className="relative w-full flex justify-center">
      <Image
        src="/logo.png"
        alt="Sama Alostoura Logo"
        width={500}
        height={200}
        priority
        className="h-auto max-w-sm"
      />
    </div>
  )
}
