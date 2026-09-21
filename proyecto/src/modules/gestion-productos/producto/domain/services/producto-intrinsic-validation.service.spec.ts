import { BadRequestException } from '@nestjs/common';
import { ProductoIntrinsicValidationService } from './producto-intrinsic-validation.service.ts';

describe('ProductoIntrinsicValidationService - CR-001 costo', () => {
  const service = new ProductoIntrinsicValidationService();

  it.each([100, 0.01])('acepta costo positivo %s (CA1)', (costo) => {
    expect(() => service.validarCosto(costo)).not.toThrow();
  });

  it.each<[unknown, string]>([
    [undefined, 'El costo es obligatorio'],
    [null, 'El costo es obligatorio'],
    ['abc', 'El costo debe ser numérico'],
    ['100', 'El costo debe ser numérico'],
    [true, 'El costo debe ser numérico'],
    [NaN, 'El costo debe ser numérico'],
    [Infinity, 'El costo debe ser numérico'],
    [-Infinity, 'El costo debe ser numérico'],
    [0, 'El costo debe ser mayor a 0'],
    [-1, 'El costo debe ser mayor a 0'],
    [-0.01, 'El costo debe ser mayor a 0'],
  ])('rechaza costo %s con el mensaje correspondiente (CA1/CA3)', (costo, mensaje) => {
    expect(() => service.validarCosto(costo)).toThrow(
      new BadRequestException(mensaje),
    );
  });
});
