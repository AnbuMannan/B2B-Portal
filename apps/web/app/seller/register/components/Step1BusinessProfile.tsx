'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { saveKycDraft, loadKycDraft } from '@/stores/kycStore';

const INDUSTRY_OPTIONS = [
  'Agriculture & Farm Products', 'Automobiles & Auto Parts', 'Chemicals & Petrochemicals',
  'Construction & Real Estate', 'Electronics & Electrical', 'Food & Beverages',
  'Garments & Textiles', 'Healthcare & Pharma', 'Industrial Machinery', 'Jewellery',
  'Paper & Packaging', 'Plastics & Rubber', 'Steel & Metal', 'Toys & Sports',
];

const step1Schema = z.object({
  companyName: z.string().min(3, 'Company name must be at least 3 characters'),
  companyType: z.enum(['PROPRIETORSHIP', 'PRIVATE_LIMITED', 'LLP'], {
    required_error: 'Please select company type',
  }),
  industryType: z.array(z.string()).min(1, 'Select at least one industry'),
  businessModel: z.enum(['MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'RETAILER'], {
    required_error: 'Please select your business model',
  }),
  hasIEC: z.boolean(),
});

type Step1Form = z.infer<typeof step1Schema>;

interface Props {
  onNext: (data: Step1Form) => void;
}

export default function Step1BusinessProfile({ onNext }: Props) {
  const draft = loadKycDraft();

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Step1Form>({
    resolver: zodResolver(step1Schema),
    defaultValues: (draft.step1 as Step1Form | undefined) ?? {
      companyName: '',
      industryType: [],
      hasIEC: false,
    },
  });

  const selectedIndustries = watch('industryType') ?? [];

  const onSubmit = (data: Step1Form) => {
    // Assert the type to bypass the Zod inference mismatch
    saveKycDraft({ step1: data as Required<Step1Form>, currentStep: 2 });
    onNext(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Company Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Company / Business Name <span className="text-red-500">*</span>
        </label>
        <input
          {...register('companyName')}
          type="text"
          placeholder="e.g. Bharat Traders Pvt Ltd"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {errors.companyName && (
          <p className="text-red-600 text-xs mt-1">{errors.companyName.message}</p>
        )}
      </div>

      {/* Company Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Company Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['PROPRIETORSHIP', 'PRIVATE_LIMITED', 'LLP'] as const).map((type) => (
            <label
              key={type}
              className="flex flex-col items-center justify-center p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 border-gray-200 hover:border-gray-300 transition-colors"
            >
              <input
                {...register('companyType')}
                type="radio"
                value={type}
                className="sr-only"
              />
              <span className="text-xs font-medium text-center leading-tight">
                {type === 'PROPRIETORSHIP' ? 'Proprietorship' : type === 'PRIVATE_LIMITED' ? 'Pvt Ltd' : 'LLP'}
              </span>
            </label>
          ))}
        </div>
        {errors.companyType && (
          <p className="text-red-600 text-xs mt-1">{errors.companyType.message}</p>
        )}
      </div>

      {/* Industry Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Industry / Sector <span className="text-red-500">*</span>
          <span className="text-gray-400 font-normal ml-1">(select all that apply)</span>
        </label>
        <Controller
          control={control}
          name="industryType"
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
              {INDUSTRY_OPTIONS.map((industry) => (
                <label
                  key={industry}
                  className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={field.value?.includes(industry) ?? false}
                    onChange={(e) => {
                      if (e.target.checked) {
                        field.onChange([...(field.value ?? []), industry]);
                      } else {
                        field.onChange(field.value?.filter((v) => v !== industry) ?? []);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-700">{industry}</span>
                </label>
              ))}
            </div>
          )}
        />
        {selectedIndustries.length > 0 && (
          <p className="text-blue-600 text-xs mt-1">{selectedIndustries.length} selected</p>
        )}
        {errors.industryType && (
          <p className="text-red-600 text-xs mt-1">{errors.industryType.message}</p>
        )}
      </div>

      {/* Business Model */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Model <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {(['MANUFACTURER', 'WHOLESALER', 'DISTRIBUTOR', 'RETAILER'] as const).map((model) => (
            <label
              key={model}
              className="flex items-center gap-2 p-3 border-2 rounded-lg cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50 border-gray-200 hover:border-gray-300 transition-colors"
            >
              <input
                {...register('businessModel')}
                type="radio"
                value={model}
                className="sr-only"
              />
              <span className="text-sm font-medium capitalize">{model.toLowerCase()}</span>
            </label>
          ))}
        </div>
        {errors.businessModel && (
          <p className="text-red-600 text-xs mt-1">{errors.businessModel.message}</p>
        )}
      </div>

      {/* IEC */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            {...register('hasIEC')}
            type="checkbox"
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            I have an IEC (Importer Exporter Code) issued by DGFT
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        Continue to Address →
      </button>
    </form>
  );
}
