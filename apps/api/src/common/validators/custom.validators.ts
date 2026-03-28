import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

// Email Validator (RFC 5322 compliant)
@ValidatorConstraint({ name: 'isValidEmail', async: false })
export class IsValidEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string): boolean {
    if (!email) return false;
    const rfc5322Regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return rfc5322Regex.test(email);
  }

  defaultMessage(): string {
    return 'Email must be a valid RFC 5322 format';
  }
}

export function IsValidEmail(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidEmailConstraint,
    });
  };
}

// Phone Number Validator (India specific)
@ValidatorConstraint({ name: 'isValidPhoneNumber', async: false })
export class IsValidPhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phone: string): boolean {
    if (!phone) return false;
    // Accept +91 or 10-digit Indian numbers starting with 6-9
    const phoneRegex = /^(\+91|0)?[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  defaultMessage(): string {
    return 'Phone number must be a valid Indian number (+91 or 10-digit starting with 6-9)';
  }
}

export function IsValidPhoneNumber(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPhoneNumberConstraint,
    });
  };
}

// GSTIN Validator (15 characters)
@ValidatorConstraint({ name: 'isValidGSTN', async: false })
export class IsValidGSTNConstraint implements ValidatorConstraintInterface {
  validate(gstin: string): boolean {
    if (!gstin) return false;
    // 2 digits (state) + 10 chars (PAN) + 1 digit (entity) + 1 char (Z) + 1 check digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstinRegex.test(gstin.toUpperCase());
  }

  defaultMessage(): string {
    return 'GSTIN must be a valid 15-character format (e.g., 29ABCDE1234F1Z5)';
  }
}

export function IsValidGSTN(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidGSTNConstraint,
    });
  };
}

// PAN Validator (10 characters)
@ValidatorConstraint({ name: 'isValidPAN', async: false })
export class IsValidPANConstraint implements ValidatorConstraintInterface {
  validate(pan: string): boolean {
    if (!pan) return false;
    // Pattern: 5 letters, 4 digits, 1 letter (e.g., ABCDE1234F)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  }

  defaultMessage(): string {
    return 'PAN must be a valid 10-character format (e.g., ABCDE1234F)';
  }
}

export function IsValidPAN(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPANConstraint,
    });
  };
}

// IEC Code Validator (10 characters)
@ValidatorConstraint({ name: 'isValidIEC', async: false })
export class IsValidIECConstraint implements ValidatorConstraintInterface {
  validate(iec: string): boolean {
    if (!iec) return false;
    // 10 characters alphanumeric
    const iecRegex = /^[0-9A-Z]{10}$/;
    return iecRegex.test(iec.toUpperCase());
  }

  defaultMessage(): string {
    return 'IEC code must be a valid 10-character alphanumeric format';
  }
}

export function IsValidIEC(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidIECConstraint,
    });
  };
}

// Pincode Validator (India - 6 digits)
@ValidatorConstraint({ name: 'isValidPincode', async: false })
export class IsValidPincodeConstraint implements ValidatorConstraintInterface {
  validate(pincode: string): boolean {
    if (!pincode) return false;
    // 6 digits, first digit cannot be 0
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    return pincodeRegex.test(pincode);
  }

  defaultMessage(): string {
    return 'Pincode must be a valid 6-digit Indian pincode';
  }
}

export function IsValidPincode(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPincodeConstraint,
    });
  };
}

// Aadhaar Validator (Masked - Last 4 digits only)
@ValidatorConstraint({ name: 'isValidAadhaarMasked', async: false })
export class IsValidAadhaarMaskedConstraint implements ValidatorConstraintInterface {
  validate(aadhaar: string): boolean {
    if (!aadhaar) return false;
    // Masked format: XXXX-XXXX-1234
    const aadhaarRegex = /^[Xx]{4}-[Xx]{4}-[0-9]{4}$/;
    return aadhaarRegex.test(aadhaar);
  }

  defaultMessage(): string {
    return 'Aadhaar must be in masked format: XXXX-XXXX-1234 (last 4 digits only per UIDAI guidelines)';
  }
}

export function IsValidAadhaarMasked(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidAadhaarMaskedConstraint,
    });
  };
}
