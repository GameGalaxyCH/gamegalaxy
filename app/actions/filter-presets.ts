'use server'

import { prisma } from "@/lib/prisma";

export async function getFilterPresets(context: string) {
  try {
    const presets = await prisma.filterPreset.findMany({
      where: { context },
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data: presets };
  } catch (error) {
    return { success: false, error: "Failed to load presets" };
  }
}

export async function saveFilterPreset(name: string, context: string, settings: any) {
  try {
    const newPreset = await prisma.filterPreset.create({
      data: {
        name,
        context,
        settings // Prisma handles JSON serialization automatically
      }
    });
    return { success: true, data: newPreset };
  } catch (error) {
    return { success: false, error: "Failed to save preset" };
  }
}

export async function deleteFilterPreset(id: string) {
  try {
    await prisma.filterPreset.delete({ where: { id } });
    return { success: true };
  } catch (error) {
    return { success: false, error: "Failed to delete preset" };
  }
}