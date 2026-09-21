import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UsuarioValidator } from 'src/modules/common/utils/validation/usuario-validator';
import { UsuarioService } from 'src/modules/gestion-usuario/usuario/application/services/usuario.service';
import { AlicuotaIva } from 'src/modules/organizacion/enums/alicuota-iva.enum';
import { ProveedorService } from 'src/modules/organizacion/proveedor/application/services/proveedor.service';
import { LineaService } from '../../../linea/application/services/linea.service';
import { MarcaService } from '../../../marca/application/services/marca.service';
import { Producto } from '../../domain/entities/producto.entity';
import { ProductoIntrinsicValidationService } from '../../domain/services/producto-intrinsic-validation.service.ts';
import { ProductoValidationService } from '../../domain/services/producto-validation.service.ts';
import { CreateProductoDto } from '../../dto/create-producto.dto';
import { UpdateProductoDto } from '../../dto/update-producto.dto';
import { ProductoRelatedEntitiesValidator } from '../../infraestructure/validators/producto-related-entities.validator.ts';
import { ProductoUniquenessValidator } from '../../infraestructure/validators/producto-uniqueness.validator.ts';
import { ProductoDeletePolicy } from '../policies/producto-delete.policy';
import { ProductoService } from './producto.service';

describe('ProductoService - CR-001 costo', () => {
  let service: ProductoService;
  let productoPersistido: Producto;
  let repository: { create: jest.Mock; update: jest.Mock; findOne: jest.Mock };
  let usuarioValidator: { validarUsuarioExiste: jest.Mock };

  const marca = { id: 1, sistema: 0 };
  const linea = { id: 1, sistema: 0 };
  const usuario = { id: 1 };
  const datosCreacion: CreateProductoDto = {
    denominacion: 'producto valido',
    costo: 100,
    precio: 150,
    utilizaStockMinimo: false,
    utilizaPack: false,
    lineaId: 1,
    marcaId: 1,
    alicuotaIva: AlicuotaIva.ALICUOTA_21,
    usuarioCreatedId: 1,
  };

  const costosInvalidos: Array<[unknown, string]> = [
    [null, 'El costo es obligatorio'],
    ['abc', 'El costo debe ser numérico'],
    [NaN, 'El costo debe ser numérico'],
    [Infinity, 'El costo debe ser numérico'],
    [-Infinity, 'El costo debe ser numérico'],
    [0, 'El costo debe ser mayor a 0'],
    [-1, 'El costo debe ser mayor a 0'],
  ];

  beforeEach(async () => {
    productoPersistido = {
      id: 1,
      denominacion: 'producto valido',
      costo: 100,
      precio: 150,
      marcaId: 1,
      lineaId: 1,
      alicuotaIva: AlicuotaIva.ALICUOTA_21,
    } as Producto;

    // El repositorio conserva estado para detectar mutaciones antes del rechazo.
    repository = {
      findOne: jest.fn().mockImplementation(async () => productoPersistido),
      create: jest.fn().mockImplementation(async (dto) => ({ id: 2, ...dto })),
      update: jest.fn().mockImplementation(async (_, dto) => {
        Object.assign(productoPersistido, dto);
        return productoPersistido;
      }),
    };
    usuarioValidator = {
      validarUsuarioExiste: jest.fn().mockResolvedValue(usuario),
    };

    const module = await Test.createTestingModule({
      providers: [
        ProductoService,
        ProductoIntrinsicValidationService,
        ProductoValidationService,
        { provide: 'IProductoRepository', useValue: repository },
        { provide: LineaService, useValue: {} },
        { provide: MarcaService, useValue: {} },
        { provide: ProveedorService, useValue: {} },
        { provide: UsuarioService, useValue: {} },
        { provide: ProductoDeletePolicy, useValue: {} },
        { provide: UsuarioValidator, useValue: usuarioValidator },
        {
          provide: ProductoRelatedEntitiesValidator,
          useValue: {
            validarYObtenerEntidadesRelacionadas: jest.fn().mockResolvedValue({ marca, linea }),
          },
        },
        {
          provide: ProductoUniquenessValidator,
          useValue: {
            validarDenominacionUnica: jest.fn().mockResolvedValue(undefined),
            validarCodigoProveedorUnico: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ProductoService>(ProductoService);
  });

  it.each([100, 0.01])('CREATE: persiste costo positivo %s (CA1)', async (costo) => {
    const dto = { ...datosCreacion, costo };

    await service.create(dto);

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.create).toHaveBeenCalledWith(dto, linea, marca, usuario);
  });

  it.each(costosInvalidos)(
    'CREATE: costo %s rechazado no llega al repositorio, aun sin DTO (CA1/CA3)',
    async (costo, mensaje) => {
      const dto = { ...datosCreacion, costo } as unknown as CreateProductoDto;

      await expect(service.create(dto)).rejects.toThrow(new BadRequestException(mensaje));

      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it('CREATE: rechaza costo omitido en llamadas internas', async () => {
    const { costo, ...sinCosto } = datosCreacion;

    await expect(service.create(sinCosto as CreateProductoDto)).rejects.toThrow(
      new BadRequestException('El costo es obligatorio'),
    );

    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(costosInvalidos)(
    'UPDATE: costo %s rechazado conserva costo 100 y precio 150 (CA3/CA4)',
    async (costo, mensaje) => {
      const estadoAnterior = { ...productoPersistido };
      const dto = { usuarioUpdatedId: 1, costo, precio: 999 } as unknown as UpdateProductoDto;
      const solicitudAnterior = { ...dto };

      await expect(service.update(1, dto)).rejects.toThrow(new BadRequestException(mensaje));

      expect(repository.findOne).toHaveBeenCalledWith(1);
      expect(usuarioValidator.validarUsuarioExiste).toHaveBeenCalledWith(1);
      expect(repository.update).not.toHaveBeenCalled();
      expect(productoPersistido).toEqual(estadoAnterior);
      expect(productoPersistido.costo).toBe(100);
      expect(productoPersistido.precio).toBe(150);
      expect(dto).toEqual(solicitudAnterior);
    },
  );

  it('UPDATE: permite un costo positivo (CA4)', async () => {
    const dto = { usuarioUpdatedId: 1, costo: 125 } as UpdateProductoDto;

    await service.update(1, dto);

    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(repository.update).toHaveBeenCalledWith(1, dto, linea, marca, usuario);
    expect(productoPersistido.costo).toBe(125);
    expect(productoPersistido.precio).toBe(150);
  });

  it('UPDATE: omitir costo permite editar otro campo y conserva costo y precio (CA4)', async () => {
    const dto = {
      usuarioUpdatedId: 1,
      denominacion: 'producto editado',
    } as UpdateProductoDto;

    await service.update(1, dto);

    expect(repository.update).toHaveBeenCalledWith(1, dto, linea, marca, usuario);
    expect(dto).not.toHaveProperty('costo');
    expect(productoPersistido.denominacion).toBe('producto editado');
    expect(productoPersistido.costo).toBe(100);
    expect(productoPersistido.precio).toBe(150);
  });

  it('UPDATE: producto inexistente y costo negativo conserva NotFoundException', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.update(99, { usuarioUpdatedId: 1, costo: -1 } as UpdateProductoDto),
    ).rejects.toThrow(new NotFoundException('Producto con ID 99 no encontrado.'));

    expect(repository.findOne).toHaveBeenCalledWith(99);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('UPDATE: conserva la precedencia de las validaciones existentes ante costo negativo', async () => {
    usuarioValidator.validarUsuarioExiste.mockRejectedValue(
      new NotFoundException('Usuario no encontrado'),
    );

    await expect(
      service.update(1, { usuarioUpdatedId: 1, costo: -1 } as UpdateProductoDto),
    ).rejects.toThrow(new NotFoundException('Usuario no encontrado'));

    expect(repository.findOne).toHaveBeenCalledWith(1);
    expect(repository.update).not.toHaveBeenCalled();
    expect(productoPersistido.costo).toBe(100);
    expect(productoPersistido.precio).toBe(150);
  });
});
