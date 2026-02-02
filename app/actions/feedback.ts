'use server'

import { prisma } from "@/lib/prisma";

export interface FeedbackItem {
  id: string;
  content: string;
  createdAt: Date;
  status: string;
}

export async function addFeedback(content: string) {
  try {
    if (!content || content.trim().length === 0) {
      return { success: false, error: "Nachricht darf nicht leer sein." };
    }

    const feedback = await prisma.feedback.create({
      data: {
        content: content.trim(),
        status: 'OPEN'
      }
    });

    return { success: true, data: feedback };
  } catch (error: any) {
    console.error("Feedback Error:", error);
    return { success: false, error: "Datenbank Fehler: Tabelle existiert evtl. nicht." };
  }
}

export async function getFeedbacks() {
  try {
    const items = await prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: "Fehler beim Laden." };
  }
}

export async function updateFeedback(id: string, content: string) {
  try {
    await prisma.feedback.update({
      where: { id },
      data: { content: content.trim() }
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Fehler beim Aktualisieren." };
  }
}

export async function deleteFeedback(id: string) {
  try {
    await prisma.feedback.delete({ where: { id } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Fehler beim Löschen." };
  }
}