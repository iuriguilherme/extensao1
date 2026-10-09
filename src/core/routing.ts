/**
 * Routing entries for city routers. A route reads "to reach network N/P, send
 * to router R": the destination is the subnet behind the router, and the next
 * hop is the router's address in the subnet the player already reaches.
 */

import { cityNode, type City, type CityNode } from './city';
import { broadcastAddress, formatIp, parseIp, sameSubnet } from './ip';
import { createRng, hash, pick, pickSome, shuffle } from './random';

/** A routing entry as the form shows it: dotted addresses and a prefix length. */
export interface RouteEntry {
  destination: string;
  prefix: number;
  nextHop: string;
}

/** Stable problem codes: tests and logic check these, never the message wording. */
export type RouteIssueCode =
  | 'destination-host' | 'destination-broadcast' | 'destination-other-network'
  | 'prefix-mismatch' | 'next-hop-outside' | 'next-hop-not-router';

export interface RouteIssue {
  code: RouteIssueCode;
  message: string;
}

/** Field options for the routing form; each list holds the correct value once. */
export interface RouteChoices {
  destination: string[];
  prefix: number[];
  nextHop: string[];
}

/** The route that opens the subnet behind this router. */
export function correctRoute(city: City, routerId: string): RouteEntry {
  const router = routerOf(city, routerId);
  const child = city.subnets[router.childSubnetId!];
  return { destination: child.network, prefix: child.prefix, nextHop: router.ip };
}

/**
 * Checks a routing entry for the subnet behind a router, returning one
 * teaching problem per wrong field (empty when the route is correct). The
 * messages point at the concept to recheck and never give the right value.
 */
export function validateRoute(entry: RouteEntry, city: City, routerId: string): RouteIssue[] {
  const router = routerOf(city, routerId);
  const child = city.subnets[router.childSubnetId!];
  const parent = city.subnets[router.subnetId];
  const errors: RouteIssue[] = [];
  const fail = (code: RouteIssueCode, message: string) => errors.push({ code, message });

  // The form only offers addresses and prefixes from routeChoices.
  const destination = parseIp(entry.destination);
  const nextHop = parseIp(entry.nextHop);
  if (destination === null || nextHop === null || !Number.isInteger(entry.prefix) || entry.prefix < 0 || entry.prefix > 32) {
    throw new Error(`Malformed route entry: ${JSON.stringify(entry)}`);
  }

  // The destination is judged against the subnet behind the router, so a
  // right destination with a wrong prefix is only a prefix mistake.
  const childNet = parseIp(child.network)!;
  if (sameSubnet(destination, childNet, child.prefix)) {
    if (destination === broadcastAddress(childNet, child.prefix)) {
      fail('destination-broadcast', `${entry.destination} é o endereço de broadcast da rede, não o endereço de rede. O destino da rota é o endereço com todos os bits de host em zero.`);
    } else if (destination !== childNet) {
      fail('destination-host', `${entry.destination} é o endereço de um host, não o endereço de rede. O destino da rota é a rede inteira: zere os bits de host.`);
    }
  } else {
    fail('destination-other-network', `${entry.destination} não fica na rede que está atrás deste roteador. Pegue o endereço da interface que o roteador tem do outro lado e aplique a máscara.`);
  }

  if (entry.prefix !== child.prefix) {
    fail('prefix-mismatch', `O prefixo /${entry.prefix} não é o da rede que fica atrás deste roteador. Confira o prefixo da interface do roteador do outro lado: a rota usa o mesmo.`);
  }

  if (!sameSubnet(nextHop, parseIp(parent.network)!, parent.prefix)) {
    fail('next-hop-outside', `${entry.nextHop} não fica na sub-rede deste lado do roteador, então você não alcança esse endereço direto. O próximo salto tem que ser um endereço da rede onde você já está.`);
  } else if (nextHop !== parseIp(router.ip)) {
    fail('next-hop-not-router', `${entry.nextHop} fica na sub-rede deste lado, mas não é este roteador: o que você mandar para lá não chega ao outro lado. O próximo salto é o endereço que o roteador usa deste lado.`);
  }

  return errors;
}

/**
 * The form's options for one router: the correct value plus wrong ones that
 * each trip a different check. Seeded from the city and the router, so they
 * stay the same on every visit.
 */
export function routeChoices(city: City, routerId: string): RouteChoices {
  const router = routerOf(city, routerId);
  const child = city.subnets[router.childSubnetId!];
  const right = correctRoute(city, routerId);
  const rng = createRng((Math.imul(city.seed >>> 0, 0x27d4eb2d) ^ Math.imul(city.level, 0x165667b1) ^ hash(routerId)) >>> 0);
  const childNet = parseIp(child.network)!;

  // Destination: the router's own child-side address (a host), the child's
  // broadcast, and other networks in the city (parent or siblings).
  const others = city.subnets.filter((s) => s.id !== child.id).map((s) => s.network);
  const destination = [
    right.destination,
    child.routerChildIp!,
    formatIp(broadcastAddress(childNet, child.prefix)),
    ...pickSome(rng, others, 2),
  ];

  // Prefix: one shorter, one longer and one further off.
  const further = pick(rng, [child.prefix - 2, child.prefix + 2, child.prefix - 3, child.prefix + 3].filter((p) => p >= 8 && p <= 30));
  const prefix = [right.prefix, child.prefix - 1, child.prefix + 1, further];

  // Next hop: the router's child-side address, another device on the parent
  // subnet, and an address from some other subnet.
  const parentPeers = city.nodes.filter((n) => n.subnetId === router.subnetId && n.id !== router.id).map((n) => n.ip);
  const outside = city.nodes.filter((n) => n.subnetId !== router.subnetId).map((n) => n.ip)
    .filter((ip) => ip !== child.routerChildIp);
  const nextHop = [right.nextHop, child.routerChildIp!, ...pickSome(rng, parentPeers, 1), ...pickSome(rng, outside, 1)];

  return {
    destination: shuffle(rng, unique(destination)),
    prefix: shuffle(rng, unique(prefix)),
    nextHop: shuffle(rng, unique(nextHop)),
  };
}

function routerOf(city: City, routerId: string): CityNode {
  const router = cityNode(city, routerId);
  if (router.role !== 'router' || router.childSubnetId === null) throw new Error(`Not a city router: ${routerId}`);
  return router;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
