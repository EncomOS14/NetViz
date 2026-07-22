package com.msu.itc583.netviz.repository;

import com.msu.itc583.netviz.model.Topology;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TopologyRepository extends JpaRepository<Topology, Long> {
    List<Topology> findAllByOrderByUpdatedAtDesc();
}
