'use client'; 
 
 import { useQuery } from '@tanstack/react-query'; 
 import { Star, MapPin, CheckCircle } from 'lucide-react'; 
 import Link from 'next/link'; 
 
 interface SellerBadge {
   type: string;
   label: string;
 }

 interface Seller {
   id: string;
   companyName: string;
   logoUrl?: string;
   badges: SellerBadge[];
   productCount: number;
   yearsInBusiness: number;
   city?: string;
   state?: string;
 } 
 
 export function FeaturedSellers() { 
   const { 
     data: response, 
     isLoading, 
     error 
   } = useQuery({ 
     queryKey: ['homepage', 'featured-sellers'], 
     queryFn: async () => { 
       try { 
         const res = await fetch('/api/homepage/featured-sellers', { 
           method: 'GET', 
           headers: { 'Content-Type': 'application/json' }, 
         }); 
         
         if (!res.ok) { 
           console.error('Featured sellers API error:', res.status); 
           return { sellers: [] }; 
         } 
         
         const jsonData = await res.json(); 
         return jsonData.data || { sellers: [] }; 
       } catch (err) { 
         console.error('Featured sellers fetch error:', err); 
         return { sellers: [] }; 
       } 
     }, 
    staleTime: 1000 * 60 * 5,
    throwOnError: false,
    retry: 1,
   }); 
 
   const sellers = response?.sellers || []; 
 
   if (error) { 
    return null
   } 
 
   return ( 
     <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20"> 
       {/* Header */} 
       <div className="mb-12"> 
         <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4"> 
           Featured Sellers 
         </h2> 
         <p className="text-lg text-gray-600"> 
           Verified & trusted sellers with excellent track records 
         </p> 
       </div> 
 
       {/* Sellers Grid */} 
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"> 
         {isLoading ? ( 
           // Loading skeleton 
           Array.from({ length: 4 }).map((_, i) => ( 
             <div key={i} className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse"> 
               <div className="h-24 w-24 bg-gray-200 rounded-full mx-auto mb-4" /> 
               <div className="h-6 w-3/4 bg-gray-200 mx-auto mb-3" /> 
               <div className="h-4 w-full bg-gray-200 mb-4" /> 
               <div className="h-4 w-1/2 bg-gray-200 mx-auto" /> 
             </div> 
           )) 
         ) : sellers && sellers.length > 0 ? ( 
           // Sellers loaded 
           sellers.map((seller: Seller) => ( 
             <Link 
               key={seller.id} 
               href={`/seller/${seller.id}`} 
             > 
               <div className="h-full bg-white hover:shadow-xl transition-shadow duration-300 cursor-pointer border border-gray-200 hover:border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center text-center"> 
                 {/* Logo */} 
                 <div className="w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-4 text-4xl relative"> 
                   🏢 
                   {seller.badges?.some(b => b.type?.includes('GST')) && ( 
                     <CheckCircle className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full text-green-600" /> 
                   )} 
                 </div> 
 
                 {/* Company Name */} 
                 <h3 className="font-semibold text-gray-900 text-lg mb-3 line-clamp-2"> 
                   {seller.companyName} 
                 </h3> 
 
                 {/* Star Rating */} 
                 <div className="flex items-center justify-center gap-1 mb-4"> 
                   {Array.from({ length: 5 }).map((_, i) => ( 
                     <Star 
                       key={i} 
                       className="w-4 h-4 fill-yellow-400 text-yellow-400" 
                     /> 
                   ))} 
                 </div> 
 
                 {/* Location */} 
                 {(seller.city || seller.state) && ( 
                   <p className="flex items-center justify-center gap-1 text-sm text-gray-600 mb-3"> 
                     <MapPin className="w-4 h-4" /> 
                     {seller.city || seller.state} 
                   </p> 
                 )} 
 
                 {/* Details */} 
                 <div className="space-y-2 text-sm text-gray-600 border-t border-gray-200 pt-4 w-full"> 
                   <div className="font-medium text-blue-600"> 
                     {seller.productCount} Products 
                   </div> 
                   <div className="text-xs text-gray-500"> 
                     {seller.yearsInBusiness}+ years in business 
                   </div> 
                 </div> 
 
                 {/* Badges */} 
                 {seller.badges && seller.badges.length > 0 && ( 
                   <div className="flex flex-wrap gap-2 justify-center mt-4"> 
                     {seller.badges.slice(0, 2).map((badge, idx) => (
                       <span
                         key={idx}
                         className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium"
                       >
                         {badge.label}
                       </span>
                     ))} 
                   </div> 
                 )} 
               </div> 
             </Link> 
           )) 
         ) : ( 
           // No sellers 
           <div className="col-span-full text-center py-12"> 
             <p className="text-gray-500">No featured sellers available</p> 
           </div> 
         )} 
       </div> 
     </div> 
   ); 
 } 
