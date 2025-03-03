import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Input,
  Button,
  DropdownTrigger,
  Dropdown,
  DropdownMenu,
  DropdownItem,
  Pagination,
} from "@heroui/react";
import { title } from "@/components/primitives";
import TicketDrawer from "@/components/TicketDrawer";
import TicketEditDrawer, { Ticket } from "@/components/TicketEditDrawer";

// Statisk kolumnordning – ordna här hur kolumnerna ska visas.
const staticColumns = [
  { name: "ID", uid: "id", sortable: true },
  { name: "Kundnamn", uid: "customerName", sortable: false },
  { name: "Ärendetyp", uid: "ticketType", sortable: false },
  { name: "Produkt", uid: "firstField", sortable: false },
  { name: "Skapad", uid: "createdAt", sortable: true },
  { name: "Senast klar", uid: "dueDate", sortable: true },
  { name: "Status", uid: "status", sortable: true },
  { name: "Åtgärder", uid: "actions", sortable: false },
];

// Definiera de defaultstatusar som alltid ska finnas med
const defaultStatuses = [
  { name: "Öppen", uid: "OPEN" },
  { name: "Färdig", uid: "CLOSED" },
  { name: "Pågående", uid: "IN_PROGRESS" },
];

export default function TicketTablePage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterValue, setFilterValue] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(["id", "customerName", "ticketType", "firstField", "status", "dueDate", "actions"])
  );
  const [sortDescriptor, setSortDescriptor] = useState({
    column: "createdAt",
    direction: "descending",
  });
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const router = useRouter();

  // Drawer-states
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // State för statusalternativ som används i filtret (default + dynamiska)
  const [filterStatusOptions, setFilterStatusOptions] = useState(defaultStatuses);

  // Hämta ärenden från API:t
  useEffect(() => {
    fetch("/api/tickets")
      .then((res) => res.json())
      .then((data) => {
        setTickets(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Fel vid hämtning av ärenden:", err);
        setLoading(false);
      });
  }, []);

  // Hämta statusalternativ för filter (kombinera default med dynamiska statusar)
  useEffect(() => {
    async function fetchStatuses() {
      try {
        const res = await fetch("/api/tickets/statuses");
        const data = await res.json();
        if (res.ok) {
          // Mappa de dynamiska statusarna så att de får ett unikt uid baserat på deras id
          const dynamicStatuses = data.map((s: any) => ({
            ...s,
            uid: `CUSTOM_${s.id}`,
          }));
          // Slå ihop defaultstatusar med dynamiska statusar – undvik duplicat baserat på uid
          const merged = [...defaultStatuses];
          dynamicStatuses.forEach((ds: any) => {
            if (!merged.some((d) => d.uid === ds.uid)) {
              merged.push(ds);
            }
          });
          setFilterStatusOptions(merged);
        }
      } catch (error) {
        console.error("Fel vid hämtning av statusar:", error);
      }
    }
    fetchStatuses();
  }, []);

  // Funktion för att hämta ett tickets effektiva status
  const getEffectiveStatus = (ticket: Ticket) => {
    if (ticket.customStatus) {
      return `CUSTOM_${ticket.customStatus.id}`;
    }
    return typeof ticket.status === "object" ? ticket.status.uid : ticket.status;
  };

  // Filtrera ärenden baserat på kundnamn och status
  const filteredTickets = useMemo(() => {
    let result = [...tickets];
    if (filterValue) {
      result = result.filter((ticket) =>
        (ticket.customer?.name || "").toLowerCase().includes(filterValue.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((ticket) => getEffectiveStatus(ticket) === statusFilter);
    }
    return result;
  }, [tickets, filterValue, statusFilter]);

  const pages = Math.ceil(filteredTickets.length / rowsPerPage);
  const paginatedTickets = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredTickets.slice(start, start + rowsPerPage);
  }, [filteredTickets, page, rowsPerPage]);

  const sortedTickets = useMemo(() => {
    return [...paginatedTickets].sort((a, b) => {
      const first = a[sortDescriptor.column];
      const second = b[sortDescriptor.column];
      const cmp = first < second ? -1 : first > second ? 1 : 0;
      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [paginatedTickets, sortDescriptor]);

  const headerColumns = useMemo(() => {
    return staticColumns.filter((column) => visibleColumns.has(column.uid));
  }, [visibleColumns]);

  const handleOpenViewDrawer = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setViewDrawerOpen(true);
  }, []);

  const handleOpenEditDrawer = useCallback((ticket: Ticket) => {
    setSelectedTicket(ticket);
    setEditDrawerOpen(true);
  }, []);

  const handleDelete = useCallback((ticketId: number) => {
    if (confirm("Är du säker på att du vill ta bort detta ärende?")) {
      fetch(`/api/tickets/${ticketId}`, { method: "DELETE" })
        .then((res) => {
          if (res.ok) {
            setTickets((prev) => prev.filter((ticket) => ticket.id !== ticketId));
          } else {
            console.error("Fel vid borttagning av ärende");
          }
        })
        .catch((err) => console.error("Fel vid borttagning av ärende", err));
    }
  }, []);

  const renderCell = useCallback(
    (ticket: Ticket, columnKey: string) => {
      switch (columnKey) {
        case "createdAt":
          return ticket.createdAt
            ? new Date(ticket.createdAt).toLocaleDateString("en-GB")
            : "-";
        case "customerName":
          return ticket.customer ? ticket.customer.name : "-";
        case "ticketType":
          return ticket.ticketType ? ticket.ticketType.name : "-";
        case "firstField": {
          if (
            ticket.ticketType &&
            Array.isArray(ticket.ticketType.fields) &&
            ticket.ticketType.fields.length > 0
          ) {
            const key = ticket.ticketType.fields[0].name;
            let value = ticket.dynamicFields && ticket.dynamicFields[key];
            return value !== undefined ? value : "-";
          }
          return "-";
        }
        case "status": {
          const defaultStatusColors = {
            OPEN: "#ff9500",
            CLOSED: "#3BAB48",
            IN_PROGRESS: "#ffa500",
          };
          const displayNames = {
            OPEN: "Öppen",
            CLOSED: "Färdig",
            IN_PROGRESS: "Pågående",
          };
          if (ticket.customStatus && typeof ticket.customStatus === "object") {
            const statusColor = ticket.customStatus.color || "#cccccc";
            return (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: statusColor }} />
                <span>{ticket.customStatus.name}</span>
              </div>
            );
          } else if (ticket.status && typeof ticket.status === "object") {
            const statusColor =
              ticket.status.color || defaultStatusColors[ticket.status.uid] || "#cccccc";
            return (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: statusColor }} />
                <span>{displayNames[ticket.status.uid] || ticket.status.name}</span>
              </div>
            );
          } else if (typeof ticket.status === "string") {
            const statusColor = defaultStatusColors[ticket.status] || "#cccccc";
            return (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: statusColor }} />
                <span>{displayNames[ticket.status] || ticket.status}</span>
              </div>
            );
          }
          return <span>-</span>;
        }
        case "dueDate":
          return ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString("en-GB") : "-";
        case "actions":
          return (
            <div className="flex gap-2">
              <Button size="sm" variant="flat" onPress={() => handleOpenViewDrawer(ticket)}>
                Öppna
              </Button>
              <Button size="sm" variant="flat" onPress={() => handleOpenEditDrawer(ticket)}>
                Editera
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="danger"
                onPress={() => handleDelete(ticket.id)}
              >
                Ta bort
              </Button>
            </div>
          );
        default: {
          let value = ticket[columnKey];
          if (
            value === undefined &&
            ticket.dynamicFields &&
            ticket.dynamicFields[columnKey] !== undefined
          ) {
            value = ticket.dynamicFields[columnKey];
          }
          if (typeof value === "string") {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
              return date.toLocaleDateString("en-GB");
            }
          }
          return value !== undefined && value !== null ? value : "-";
        }
      }
    },
    [handleOpenViewDrawer, handleOpenEditDrawer, handleDelete]
  );

  const onNextPage = () => {
    if (page < pages) setPage(page + 1);
  };

  const onPreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const onRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(Number(e.target.value));
    setPage(1);
  };

  const onSearchChange = (value: string) => {
    setFilterValue(value);
    setPage(1);
  };

  const topContent = useMemo(() => (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between gap-3 items-end">
        <Input
          isClearable
          className="w-full sm:max-w-[44%]"
          placeholder="Sök på kund..."
          value={filterValue}
          onClear={() => onSearchChange("")}
          onValueChange={onSearchChange}
        />
        <div className="flex gap-3">
          <Dropdown>
            <DropdownTrigger className="hidden sm:flex">
              <Button endContent={<span>⌄</span>} variant="flat">
                Status
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Filtrera på status"
              closeOnSelect
              selectedKeys={statusFilter === "all" ? new Set() : new Set([statusFilter])}
              onSelectionChange={(keys) => {
                const key = keys.values().next().value;
                setStatusFilter(key || "all");
                setPage(1);
              }}
              selectionMode="single"
            >
              <DropdownItem key="all">Alla</DropdownItem>
              {filterStatusOptions.map((option) => (
                <DropdownItem key={option.uid}>{option.name}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
          <Dropdown>
            <DropdownTrigger className="hidden sm:flex">
              <Button endContent={<span>⌄</span>} variant="flat">
                Kolumner
              </Button>
            </DropdownTrigger>
            <DropdownMenu
              disallowEmptySelection
              aria-label="Välj kolumner"
              closeOnSelect={false}
              selectedKeys={visibleColumns}
              selectionMode="multiple"
              onSelectionChange={setVisibleColumns}
            >
              {staticColumns.map((column) => (
                <DropdownItem key={column.uid}>{column.name}</DropdownItem>
              ))}
            </DropdownMenu>
          </Dropdown>
          <Button color="primary" onPress={() => router.push("/nytt-arende")}>
            Skapa nytt
          </Button>
        </div>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-default-400 text-small">
          Totalt {filteredTickets.length} ärenden
        </span>
        <label className="flex items-center text-default-400 text-small">
          Rader per sida:
          <select
            className="bg-transparent outline-none text-default-400 text-small"
            onChange={onRowsPerPageChange}
            value={rowsPerPage}
          >
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
          </select>
        </label>
      </div>
    </div>
  ), [filterValue, filteredTickets.length, rowsPerPage, visibleColumns, statusFilter, router, filterStatusOptions]);

  const bottomContent = useMemo(() => (
    <div className="py-2 px-2 flex justify-between items-center">
      <span className="w-[30%] text-small text-default-400">
        {`Visar ${sortedTickets.length} av ${filteredTickets.length} ärenden`}
      </span>
      <Pagination
        isCompact
        showControls
        showShadow
        color="primary"
        page={page}
        total={pages}
        onChange={setPage}
      />
      <div className="hidden sm:flex w-[30%] justify-end gap-2">
        <Button isDisabled={page === 1} size="sm" variant="flat" onPress={onPreviousPage}>
          Föregående
        </Button>
        <Button isDisabled={page === pages} size="sm" variant="flat" onPress={onNextPage}>
          Nästa
        </Button>
      </div>
    </div>
  ), [page, pages, filteredTickets.length, sortedTickets.length]);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Laddar ärenden...</div>
      </section>
    );
  }

  return (
    <>
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div className="inline-block max-w-lg text-center">
          <h1 className={title()}>Ärenden</h1>
        </div>
        <Table
          isHeaderSticky
          aria-label="Tickets Table"
          topContent={topContent}
          topContentPlacement="outside"
          bottomContent={bottomContent}
          bottomContentPlacement="outside"
          selectedKeys={new Set()}
          selectionMode="none"
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
        >
          <TableHeader columns={headerColumns}>
            {(column) => (
              <TableColumn key={column.uid} align="start" allowsSorting={column.sortable}>
                {column.name}
              </TableColumn>
            )}
          </TableHeader>
          <TableBody emptyContent="Inga ärenden hittades">
            {sortedTickets.map((ticket) => (
              <TableRow key={ticket.id}>
                {(columnKey) => <TableCell>{renderCell(ticket, columnKey)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      {/* Drawer för att visa ärendedetaljer */}
      <TicketDrawer
        isOpen={viewDrawerOpen}
        onClose={() => setViewDrawerOpen(false)}
        ticket={selectedTicket}
      />
      {/* Drawer för att redigera ärende */}
      <TicketEditDrawer
        isOpen={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        ticket={selectedTicket}
        onTicketUpdated={(updatedTicket) => {
          setTickets((prev) =>
            prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket))
          );
        }}
      />
    </>
  );
}
