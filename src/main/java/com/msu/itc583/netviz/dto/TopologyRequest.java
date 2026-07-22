package com.msu.itc583.netviz.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TopologyRequest {

    @NotBlank
    @Size(max = 120)
    private String name;

    @Size(max = 500)
    private String description;

    @NotBlank
    private String topologyJson;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTopologyJson() {
        return topologyJson;
    }

    public void setTopologyJson(String topologyJson) {
        this.topologyJson = topologyJson;
    }
}
