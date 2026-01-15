export enum EventType {
  RSVP_CREATED = 'rsvp.created',
  RSVP_UPDATED = 'rsvp.updated',
  RSVP_DELETED = 'rsvp.deleted',
  RSVP_CANCELLED = 'rsvp.cancelled',
}

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  eventId: string;
}

export interface RSVPCreatedEvent extends BaseEvent {
  type: EventType.RSVP_CREATED;
  data: {
    rsvpId: number;
    email: string;
    name: string;
    createdAt: string;
  };
}

export interface RSVPUpdatedEvent extends BaseEvent {
  type: EventType.RSVP_UPDATED;
  data: {
    rsvpId: number;
    email: string;
    oldEmail?: string;
    name?: string;
    updatedAt: string;
  };
}

export interface RSVPDeletedEvent extends BaseEvent {
  type: EventType.RSVP_DELETED;
  data: {
    rsvpId: number;
    email: string;
    deletedAt: string;
  };
}

export interface RSVPCancelledEvent extends BaseEvent {
  type: EventType.RSVP_CANCELLED;
  data: {
    rsvpId: number;
    email: string;
    cancelledAt: string;
  };
}

export type RSVPEvent = RSVPCreatedEvent | RSVPUpdatedEvent | RSVPDeletedEvent | RSVPCancelledEvent;

export const KAFKA_TOPICS = {
  RSVP_EVENTS: 'rsvp-events',
} as const;
