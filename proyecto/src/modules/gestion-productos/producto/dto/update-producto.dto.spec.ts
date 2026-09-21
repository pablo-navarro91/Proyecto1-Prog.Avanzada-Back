import { ValidationPipe } from '@nestjs/common';
import { UpdateProductoDto } from './update-producto.dto';

describe('UpdateProductoDto - CR-001 costo', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const validar = (datos: object) =>
    pipe.transform(datos, { type: 'body', metatype: UpdateProductoDto });

  it.each([100, 0.01])('acepta costo positivo %s (CA3/CA4)', async (costo) => {
    await expect(validar({ usuarioUpdatedId: 1, costo })).resolves.toMatchObject({
      costo,
    });
  });

  it('permite omitir costo y los demás campos heredados (CA4)', async () => {
    const dto = await validar({ usuarioUpdatedId: 1 });

    expect(dto.costo).toBeUndefined();
    expect(dto.denominacion).toBeUndefined();
    expect(dto.marcaId).toBeUndefined();
    expect(dto.lineaId).toBeUndefined();
  });

  it('permite costo undefined en una actualización parcial (CA4)', async () => {
    await expect(
      validar({ usuarioUpdatedId: 1, costo: undefined }),
    ).resolves.toMatchObject({ usuarioUpdatedId: 1 });
  });

  it.each([null, 'abc', '100', true, NaN, Infinity, -Infinity])(
    'rechaza costo %s con un único mensaje numérico (CA3/CA4)',
    async (costo) => {
      await expect(validar({ usuarioUpdatedId: 1, costo })).rejects.toMatchObject({
        response: {
          statusCode: 400,
          message: ['El costo debe ser numérico'],
        },
      });
    },
  );

  it.each([0, -1])('delega el rango de costo %s al dominio (CA4)', async (costo) => {
    await expect(validar({ usuarioUpdatedId: 1, costo })).resolves.toMatchObject({
      costo,
    });
  });

  it('conserva la aceptación de null de PartialType para los otros campos', async () => {
    await expect(
      validar({ usuarioUpdatedId: 1, marcaId: null, observacion: null }),
    ).resolves.toMatchObject({ marcaId: null, observacion: null });
  });

  it('conserva la validación de tipo de los otros campos heredados', async () => {
    await expect(validar({ usuarioUpdatedId: 1, stock: 'abc' })).rejects.toMatchObject({
      response: { statusCode: 400, message: ['stock must be an integer number'] },
    });
  });
});
