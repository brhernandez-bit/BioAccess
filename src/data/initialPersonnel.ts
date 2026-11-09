import { Personnel } from '../types';
import { createSyntheticPortrait } from '../utils/avatarGenerator';

export const INITIAL_PERSONNEL: Personnel[] = [
  {
    id: 'TRIP-80124',
    name: 'Capitán Roberto Silva',
    role: 'Capitán de Navío',
    vessel: 'B/M Atlántico Express',
    isAuthorized: true,
    photoUrl: createSyntheticPortrait('Cap. Roberto Silva', 'Capitán', 'm', '#e0ac69', '#374151', false),
    registeredAt: '2026-01-10',
  },
  {
    id: 'TRIP-80219',
    name: 'Ing. Elena Gómez',
    role: 'Jefe de Máquinas',
    vessel: 'B/M Atlántico Express',
    isAuthorized: true,
    photoUrl: createSyntheticPortrait('Elena Gómez', 'Jefe Máquinas', 'f', '#fcd34d', '#7c2d12', true),
    registeredAt: '2026-02-04',
  },
  {
    id: 'TRIP-80355',
    name: 'Andrés Cardona',
    role: 'Oficial de Seguridad Marítima',
    vessel: 'B/M Atlántico Express',
    isAuthorized: true,
    photoUrl: createSyntheticPortrait('Andrés Cardona', 'Of. Seguridad', 'm', '#c68642', '#18181b', false),
    registeredAt: '2026-02-18',
  },
  {
    id: 'TRIP-80412',
    name: 'Mateo Rivas',
    role: 'Marinero de Cubierta',
    vessel: 'B/M Atlántico Express',
    isAuthorized: true,
    photoUrl: createSyntheticPortrait('Mateo Rivas', 'Marinero', 'm', '#e0ac69', '#4b5563', false),
    registeredAt: '2026-03-01',
  },
  {
    id: 'EXT-90041',
    name: 'Víctor Morales',
    role: 'Contratista de Calderas (SUSPENDIDO)',
    vessel: 'B/M Atlántico Express',
    isAuthorized: false, // Testing denied access for non-authorized personnel
    photoUrl: createSyntheticPortrait('Víctor Morales', 'Contratista', 'm', '#8d5524', '#262626', true),
    registeredAt: '2026-03-12',
  },
];
