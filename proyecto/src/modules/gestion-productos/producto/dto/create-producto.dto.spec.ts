import { ValidationPipe } from '@nestjs/common';
import { AlicuotaIva } from 'src/modules/organizacion/enums/alicuota-iva.enum';
import { CreateProductoDto } from './create-producto.dto';

describe('CreateProductoDto - CR-001 costo', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const datosSinCosto = {
    denominacion: 'producto valido',
    utilizaStockMinimo: false,
    utilizaPack: false,
    lineaId: 1,
    marcaId: 1,
    alicuotaIva: AlicuotaIva.ALICUOTA_21,
    usuarioCreatedId: 1,
    precio: 150,
  };

  const validar = (datos: object) =>
    pipe.transform(datos, { type: 'body', metatype: CreateProductoDto });

  it.each([100, 0.01])('acepta costo positivo %s (CA1/CA3)', async (costo) => {
    await expect(validar({ ...datosSinCosto, costo })).resolves.toMatchObject({
      costo,
    });
  });

  it.each<[string, object]>([
    ['omitido', {}],
    ['undefined', { costo: undefined }],
    ['null', { costo: null }],
  ])('rechaza costo %s con un único mensaje de obligatoriedad', async (_, costo) => {
    await expect(validar({ ...datosSinCosto, ...costo })).rejects.toMatchObject({
      response: {
        statusCode: 400,
        message: ['El costo es obligatorio'],
      },
    });
  });

  it.each(['abc', '100', true, NaN, Infinity, -Infinity])(
    'rechaza costo no numérico o no finito %s con un único mensaje (CA3)',
    async (costo) => {
      await expect(validar({ ...datosSinCosto, costo })).rejects.toMatchObject({
        response: {
          statusCode: 400,
          message: ['El costo debe ser numérico'],
        },
      });
    },
  );

  it.each([0, -1])('delega el rango de costo %s al dominio (CA1)', async (costo) => {
    await expect(validar({ ...datosSinCosto, costo })).resolves.toMatchObject({
      costo,
    });
  });
});
