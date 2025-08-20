'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { PokemonCardProps } from '@/types/pokemon';
import { CollectionButtons, getAvailableVariants } from './CollectionButtons';

// Optimized blur placeholder for better loading experience
